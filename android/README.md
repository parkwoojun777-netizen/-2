# 안드로이드 앱 틀

창작기의 **📱 안드로이드 앱으로 저장**이 쓰는 앱 틀(`template.apk`)을 만드는 곳이에요.

- `src/.../MainActivity.java` — 앱 안의 `assets/game.html` 을 화면 가득 보여주는 플레이어 (WebView)
- `stubs/` — 컴파일할 때만 쓰는 안드로이드 클래스 껍데기 (앱에는 들어가지 않아요)
- `build_template.py` — 매니페스트 · 리소스 표를 직접 만들고 zip 으로 묶어 `template.apk` 를 만들어요
- 창작기는 `../apk.js` 로 틀에 게임 · 아이콘 · 앱 이름을 넣고 **APK 서명 v2** 로 서명해요 (브라우저 안에서)

## 다시 만들기
```sh
javac --release 8 -d build/stubs $(find stubs -name '*.java')
javac --release 8 -cp build/stubs -d build/classes src/com/novelworkshop/player/MainActivity.java
java -cp dalvik-dx.jar com.android.dx.command.Main --dex --min-sdk-version=24 --output=build/classes.dex build/classes
python3 build_template.py build/classes.dex build      # → build/template.apk, build/apk-template.js
cp build/apk-template.js ../apk-template.js
```
`dalvik-dx.jar`: Maven Central `com.jakewharton.android.repackaged:dalvik-dx:11.0.0_r3`

안드로이드 7.0(API 24) 이상, targetSdk 34.
