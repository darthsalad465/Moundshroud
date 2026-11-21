#!/bin/bash
set -eu

# The Playground writes one envelope to stdin: "<source bytes> <input bytes>\n", then exactly that many bytes of
# source, then the Input box text. Split it with head -c (which reads exactly N bytes from a pipe) so the source
# and the program's own stdin are separate. If the envelope is missing, refuse rather than compile garbage.
read -r src_bytes in_bytes || { echo 'The Playground did not send a program.' >&2; exit 2; }
case "${src_bytes}:${in_bytes}" in
  *[!0-9:]*|:*) echo 'The Playground sent an invalid program envelope.' >&2; exit 2 ;;
esac
src=/work/source
input=/work/input.txt
: > "$src"
: > "$input"
take() {
  if [ "$1" -gt 0 ]; then head -c "$1" >> "$2"; fi
}
take "$src_bytes" "$src"
take "$in_bytes" "$input"

case "$1" in
  bash)       cp "$src" main.sh; exec bash main.sh < "$input" ;;
  powershell) cp "$src" main.ps1; exec pwsh -NoLogo -NoProfile -NonInteractive -File main.ps1 < "$input" ;;
  c)          cp "$src" main.c; gcc -std=c17 main.c -lm -o program; exec ./program < "$input" ;;
  cpp)        cp "$src" main.cpp; g++ -std=c++20 main.cpp -o program; exec ./program < "$input" ;;
  holyc)      cp "$src" main.HC; exec hcc -jit main.HC < "$input" ;;
  java)       cp "$src" Main.java; exec java -Xmx256m Main.java < "$input" ;;
  csharp)
    cp "$src" Program.cs
    cat > Playground.csproj <<'EOF'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <NuGetAudit>false</NuGetAudit>
    <UseSharedCompilation>false</UseSharedCompilation>
  </PropertyGroup>
</Project>
EOF
    printf '%s\n' '<configuration><packageSources><clear /></packageSources></configuration>' > NuGet.Config
    exec dotnet run --project Playground.csproj < "$input"
    ;;
  go)         cp "$src" main.go; exec go run main.go < "$input" ;;
  rust)       cp "$src" main.rs; rustc --edition=2021 main.rs -o program; exec ./program < "$input" ;;
  typescript)
    cp "$src" main.ts
    tsc --target ES2022 --module commonjs --strict --noEmitOnError main.ts
    exec node main.js < "$input"
    ;;
  kotlin)     cp "$src" Main.kt; /opt/kotlinc/bin/kotlinc Main.kt -include-runtime -d main.jar; exec java -Xmx256m -jar main.jar < "$input" ;;
  swift)      cp "$src" main.swift; swiftc -module-cache-path /work/swift-cache main.swift -o program; exec ./program < "$input" ;;
  php)        cp "$src" main.php; exec php main.php < "$input" ;;
  ruby)       cp "$src" main.rb; exec ruby main.rb < "$input" ;;
  lua)        cp "$src" main.lua; exec lua5.4 main.lua < "$input" ;;
  asm)        cp "$src" main.asm; nasm -f elf64 main.asm -o main.o; ld main.o -o program; exec ./program < "$input" ;;
  *)          echo 'Unsupported Playground language.' >&2; exit 2 ;;
esac
