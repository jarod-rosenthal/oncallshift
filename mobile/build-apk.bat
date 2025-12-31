@echo off
cd /d "C:\Users\jarod\github\pagerduty-lite\mobile\android"
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set GRADLE_OPTS=-Xmx4g -XX:MaxMetaspaceSize=1g
call "C:\Users\jarod\github\pagerduty-lite\mobile\android\gradlew.bat" clean assembleRelease --no-daemon
