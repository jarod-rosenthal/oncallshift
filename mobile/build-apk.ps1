$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:GRADLE_OPTS = "-Xmx4g -XX:MaxMetaspaceSize=1g"
Set-Location "C:\Users\jarod\github\pagerduty-lite\mobile\android"
& .\gradlew.bat assembleRelease --no-daemon --stacktrace
