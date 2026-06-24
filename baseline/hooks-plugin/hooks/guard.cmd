@echo off
REM Cross-platform wrapper for guard hook (Windows). Runs the node hook script.
REM ZCode passes JSON on stdin; the script reads it and emits a decision.
node "%~dp0guard.mjs"
exit /b %ERRORLEVEL%
