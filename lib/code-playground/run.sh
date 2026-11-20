#!/bin/bash
set -eu

case "$1" in
  bash)       cat > main.sh; exec bash main.sh ;;
  powershell) cat > main.ps1; exec pwsh -NoLogo -NoProfile -NonInteractive -File main.ps1 ;;
  c)          cat > main.c; gcc -std=c17 main.c -lm -o program; exec ./program ;;
  cpp)        cat > main.cpp; g++ -std=c++20 main.cpp -o program; exec ./program ;;
  holyc)      cat > main.HC; exec hcc -jit main.HC ;;
  java)       cat > Main.java; exec java -Xmx256m Main.java ;;
  csharp)
    cat > Program.cs
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
    exec dotnet run --project Playground.csproj
    ;;
  go)         cat > main.go; exec go run main.go ;;
  rust)       cat > main.rs; rustc --edition=2021 main.rs -o program; exec ./program ;;
  typescript)
    cat > main.ts
    tsc --target ES2022 --module commonjs --strict --noEmitOnError main.ts
    exec node main.js
    ;;
  kotlin)     cat > Main.kt; /opt/kotlinc/bin/kotlinc Main.kt -include-runtime -d main.jar; exec java -Xmx256m -jar main.jar ;;
  swift)      cat > main.swift; swiftc -module-cache-path /work/swift-cache main.swift -o program; exec ./program ;;
  php)        cat > main.php; exec php main.php ;;
  ruby)       cat > main.rb; exec ruby main.rb ;;
  lua)        cat > main.lua; exec lua5.4 main.lua ;;
  asm)        cat > main.asm; nasm -f elf64 main.asm -o main.o; ld main.o -o program; exec ./program ;;
  *)          echo 'Unsupported Playground language.' >&2; exit 2 ;;
esac
