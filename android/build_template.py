#!/usr/bin/env python3
"""
노벨 공방 안드로이드 앱 틀(template.apk) 만들기.

Android SDK 없이 직접 만들어요:
  - AndroidManifest.xml  → 안드로이드 바이너리 XML(AXML)로 직접 인코딩
  - resources.arsc       → 아이콘 하나만 들어 있는 리소스 표를 직접 인코딩
  - classes.dex          → MainActivity.java 를 javac + dx 로 컴파일한 것
  - res/icon.png, assets/game.html → 창작기가 내보낼 때 바꿔 끼워요

만들어진 틀은 서명되어 있지 않아요. 창작기(apk.js)가
  1) 패키지 이름 · 앱 이름 자리표시자를 바꾸고
  2) 게임 파일과 아이콘을 넣고
  3) APK 서명 v2 로 서명해서 설치 가능한 .apk 를 만들어요.

사용법: python3 build_template.py <classes.dex> <출력 폴더>
"""
import struct
import sys
import zlib
import base64
import os

# 창작기(apk.js)가 같은 길이로 덮어쓰는 자리표시자
PACKAGE_PLACEHOLDER = "com.novelworkshop.gxxxxxxxxxxxx"   # 31자: 끝 12자를 작품마다 바꿔요
LABEL_PLACEHOLDER = "NOVEL_APP_NAME_" + "_" * 33                 # 앱 이름 자리 (48자)
ACTIVITY = "com.novelworkshop.player.MainActivity"
ICON_PATH = "res/icon.png"
ICON_ID = 0x7F010000

# 안드로이드 속성 리소스 ID (android.R.attr)
ATTR = {
    "label": 0x01010001, "icon": 0x01010002, "name": 0x01010003, "exported": 0x01010010,
    "configChanges": 0x0101001F, "minSdkVersion": 0x0101020C, "versionCode": 0x0101021B,
    "versionName": 0x0101021C, "targetSdkVersion": 0x01010270, "allowBackup": 0x01010280,
    "hardwareAccelerated": 0x010102D3,
}
T_REF, T_STRING, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12
ANDROID_NS = "http://schemas.android.com/apk/res/android"


def string_pool(strings, utf8=False):
    """ResStringPool 청크 (UTF-16)."""
    data = b""
    offsets = []
    for s in strings:
        offsets.append(len(data))
        if utf8:
            b = s.encode("utf-8")
            assert len(s) < 128 and len(b) < 128
            data += bytes([len(s), len(b)]) + b + b"\x00"
        else:
            u = s.encode("utf-16-le")
            data += struct.pack("<H", len(u) // 2) + u + b"\x00\x00"
    while len(data) % 4:
        data += b"\x00"
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    size = strings_start + len(data)
    flags = 0x100 if utf8 else 0
    head = struct.pack("<HHIIIIII", 0x0001, header_size, size, len(strings), 0, flags, strings_start, 0)
    return head + b"".join(struct.pack("<I", o) for o in offsets) + data


class Axml:
    """아주 작은 바이너리 XML 인코더."""

    def __init__(self):
        self.res_strings = []   # 리소스 ID 가 붙는 속성 이름 (앞쪽에 와야 해요)
        self.res_ids = []
        self.strings = []
        self.events = []

    def s(self, text):
        if text in self.res_strings:
            return self.res_strings.index(text)
        if text not in self.strings:
            self.strings.append(text)
        return len(self.res_strings) + self.strings.index(text)

    def attr_name(self, name):
        if name in ATTR:
            if name not in self.res_strings:
                assert not self.strings or True
                self.res_strings.append(name)
                self.res_ids.append(ATTR[name])
            return name
        return name

    def start(self, tag, attrs):
        self.events.append(("start", tag, attrs))

    def end(self, tag):
        self.events.append(("end", tag))

    def build(self):
        # 1) 리소스 속성 이름을 먼저 모아서 문자열 표 앞쪽에 둬요
        for ev in self.events:
            if ev[0] == "start":
                for (ns, name, _t, _v) in ev[2]:
                    if ns:
                        self.attr_name(name)
        idx = lambda t: self.s(t)
        ns_prefix, ns_uri = idx("android"), idx(ANDROID_NS)
        body = []
        line = 1
        body.append(struct.pack("<HHIII", 0x0100, 16, 24, line, 0xFFFFFFFF) + struct.pack("<II", ns_prefix, ns_uri))
        for ev in self.events:
            line += 1
            if ev[0] == "start":
                _, tag, attrs = ev
                packed = []
                for (ns, name, typ, val) in attrs:
                    nsi = ns_uri if ns else 0xFFFFFFFF
                    ni = idx(name)
                    if typ == T_STRING:
                        si = idx(val)
                        raw, data = si, si
                    else:
                        raw, data = 0xFFFFFFFF, val & 0xFFFFFFFF
                    rid = ATTR.get(name, 0xFFFFFFFF) if ns else 0xFFFFFFFF
                    packed.append((rid, struct.pack("<IIIHBBI", nsi, ni, raw, 8, 0, typ, data)))
                packed.sort(key=lambda p: p[0])     # 리소스 ID 순서로 정렬 (aapt 와 같은 방식)
                at = b"".join(p[1] for p in packed)
                ext = struct.pack("<IIHHHHHH", 0xFFFFFFFF, idx(tag), 20, 20, len(attrs), 0, 0, 0)
                size = 16 + len(ext) + len(at)
                body.append(struct.pack("<HHIII", 0x0102, 16, size, line, 0xFFFFFFFF) + ext + at)
            else:
                body.append(struct.pack("<HHIII", 0x0103, 16, 24, line, 0xFFFFFFFF) + struct.pack("<II", 0xFFFFFFFF, idx(ev[1])))
        body.append(struct.pack("<HHIII", 0x0101, 16, 24, line + 1, 0xFFFFFFFF) + struct.pack("<II", ns_prefix, ns_uri))
        pool = string_pool(self.res_strings + self.strings)
        resmap = struct.pack("<HHI", 0x0180, 8, 8 + 4 * len(self.res_ids)) + b"".join(struct.pack("<I", i) for i in self.res_ids)
        content = pool + resmap + b"".join(body)
        return struct.pack("<HHI", 0x0003, 8, 8 + len(content)) + content


def manifest():
    x = Axml()
    A = lambda n, t, v: (True, n, t, v)      # android: 속성
    P = lambda n, t, v: (False, n, t, v)     # 접두사 없는 속성
    x.start("manifest", [A("versionCode", T_DEC, 1), A("versionName", T_STRING, "1.0"), P("package", T_STRING, PACKAGE_PLACEHOLDER)])
    x.start("uses-sdk", [A("minSdkVersion", T_DEC, 24), A("targetSdkVersion", T_DEC, 34)]); x.end("uses-sdk")
    x.start("uses-permission", [A("name", T_STRING, "android.permission.INTERNET")]); x.end("uses-permission")
    x.start("application", [A("label", T_STRING, LABEL_PLACEHOLDER), A("icon", T_REF, ICON_ID),
                            A("allowBackup", T_BOOL, 0xFFFFFFFF), A("hardwareAccelerated", T_BOOL, 0xFFFFFFFF)])
    # orientation | keyboardHidden | screenLayout | screenSize | smallestScreenSize
    x.start("activity", [A("name", T_STRING, ACTIVITY), A("exported", T_BOOL, 0xFFFFFFFF), A("configChanges", T_HEX, 0x0DA0)])
    x.start("intent-filter", [])
    x.start("action", [A("name", T_STRING, "android.intent.action.MAIN")]); x.end("action")
    x.start("category", [A("name", T_STRING, "android.intent.category.LAUNCHER")]); x.end("category")
    x.end("intent-filter"); x.end("activity"); x.end("application"); x.end("manifest")
    return x.build()


def resources():
    """아이콘(res/icon.png) 하나만 있는 resources.arsc."""
    values = string_pool([ICON_PATH])
    types = string_pool(["mipmap"])
    keys = string_pool(["icon"])
    spec = struct.pack("<HHIBBHI", 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack("<I", 0)
    config = struct.pack("<I", 64) + b"\x00" * 60
    type_header = 8 + 1 + 1 + 2 + 4 + 4 + len(config)
    entries_start = type_header + 4
    entry = struct.pack("<HHI", 8, 0, 0) + struct.pack("<HBBI", 8, 0, T_STRING, 0)
    typ = struct.pack("<HHIBBHII", 0x0201, type_header, entries_start + len(entry), 1, 0, 0, 1, entries_start) + config + struct.pack("<I", 0) + entry
    name = "com.novelworkshop.player".encode("utf-16-le").ljust(256, b"\x00")
    pkg_header = 288
    type_off = pkg_header
    key_off = type_off + len(types)
    pkg_body = types + keys + spec + typ
    pkg = struct.pack("<HHII", 0x0200, pkg_header, pkg_header + len(pkg_body), 0x7F) + name + struct.pack("<IIIII", type_off, 1, key_off, 1, 0) + pkg_body
    content = values + pkg
    return struct.pack("<HHII", 0x0002, 12, 12 + len(content), 1) + content


def default_icon():
    """기본 아이콘 (창작기에서 캐릭터 그림 등으로 바꿀 수 있어요)."""
    try:
        from PIL import Image, ImageDraw
        im = Image.new("RGBA", (192, 192), (31, 134, 168, 255))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([40, 44, 152, 148], 14, fill=(255, 255, 255, 255))
        d.line([96, 50, 96, 142], fill=(31, 134, 168, 255), width=6)
        import io
        b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()
    except Exception:
        # 1x1 PNG
        return base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


def write_zip(entries):
    """entries: [(이름, 데이터, 압축여부)]. 압축 안 한 파일은 4바이트 정렬(zipalign 과 같은 효과)."""
    out = bytearray()
    central = bytearray()
    for name, data, deflate in entries:
        nb = name.encode()
        crc = zlib.crc32(data) & 0xFFFFFFFF
        if deflate:
            c = zlib.compressobj(9, zlib.DEFLATED, -15)
            comp = c.compress(data) + c.flush()
            method = 8
        else:
            comp, method = data, 0
        offset = len(out)
        extra = b""
        if method == 0:
            pad = (4 - (offset + 30 + len(nb)) % 4) % 4
            extra = b"\x00" * pad
        out += struct.pack("<IHHHHHIIIHH", 0x04034B50, 20, 0x0800, method, 0, 0x21, crc, len(comp), len(data), len(nb), len(extra)) + nb + extra + comp
        central += struct.pack("<IHHHHHHIIIHHHHHII", 0x02014B50, 20, 20, 0x0800, method, 0, 0x21, crc, len(comp), len(data), len(nb), 0, 0, 0, 0, 0, offset) + nb
    cd_off = len(out)
    out += central
    out += struct.pack("<IHHHHIIH", 0x06054B50, 0, 0, len(entries), len(entries), len(central), cd_off, 0)
    return bytes(out)


def main():
    dex_path, out_dir = sys.argv[1], sys.argv[2]
    dex = open(dex_path, "rb").read()
    placeholder_game = b"<!doctype html><meta charset=utf-8><title>game</title><p>game.html</p>"
    apk = write_zip([
        ("AndroidManifest.xml", manifest(), True),
        ("classes.dex", dex, True),
        ("resources.arsc", resources(), False),
        (ICON_PATH, default_icon(), False),
        ("assets/game.html", placeholder_game, True),
    ])
    os.makedirs(out_dir, exist_ok=True)
    open(os.path.join(out_dir, "template.apk"), "wb").write(apk)
    with open(os.path.join(out_dir, "apk-template.js"), "w") as f:
        f.write("/* 노벨 공방 안드로이드 앱 틀 (android/build_template.py 로 만든 것) */\n")
        f.write("window.APK_TEMPLATE_B64 = \"" + base64.b64encode(apk).decode() + "\";\n")
    print("template.apk", len(apk), "bytes")


if __name__ == "__main__":
    main()
