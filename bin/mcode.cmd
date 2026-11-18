@echo off
rem mcode - open Moundshroud Code, the coding agent, in any terminal.
rem This is only a signpost: the program itself is lib\moundshroud-code.js in the folder above.
rem Anything you type after mcode is passed straight through, e.g.   mcode --dir C:\work\site
setlocal
set "APP=%~dp0.."
if not exist "%APP%\lib\moundshroud-code.js" (
  echo mcode: Moundshroud is not where this launcher expects it - looked in "%APP%\lib"
  exit /b 1
)
set "NODE=node"
where node >nul 2>nul || set "NODE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"
set "MS_FORCE_TTY=1"
rem Uncomment the next line to debug input issues:
rem set "MS_DEBUG_INPUT=1"
"%NODE%" "%APP%\lib\moundshroud-code.js" %*
exit /b %ERRORLEVEL%
