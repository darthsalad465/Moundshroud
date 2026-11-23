// Coding › Playground: the language list. Every language has an example program and says how it runs: in the app
// (Python with Pyodide, JavaScript, HTML, SQLite) or in the Playground's own interpreters (web/js/esolangs.js,
// esolangs-words.js, minilangs.js). This build is browser-only: native host execution is disabled outright, so no
// program typed here can reach the PC. Used by web/js/code-lessons.js and the tests.
(function (root) {
  'use strict';
  const R = String.raw;
  const GROUPS = [
    ['app', 'Runs in the app'],
    ['mini', 'Classic languages (built-in interpreters)'],
    ['pc', 'Runs in a sandbox on this PC'],
    ['eso', 'Esoteric languages (built-in interpreters)'],
    ['docker', 'Runs in the Docker sandbox'],
    ['none', 'Cannot run here (browser-only)'],
  ];
  /* the languages the optional Docker image (lib/code-playground/run.sh) can run */
  const DOCKER = ['bash', 'powershell', 'c', 'cpp', 'holyc', 'java', 'csharp', 'go', 'rust', 'typescript', 'kotlin', 'swift', 'php', 'ruby', 'lua', 'asm'];
  const NOTOOL = 'This build runs code only inside the browser sandbox; native code is disabled.';
  const L = [
    /* ---------- in the app ---------- */
    { id: 'python', n: 'Python', ic: '🐍', run: 'py', ce: 'py', cm: '#', how: 'Python 3 with Pyodide, inside the app. numpy, pandas and matplotlib load on first use, and pygame, turtle and tkinter are built in: a drawing, an animation or a window shows the frames it made under the output.',
      ex: R`def fizzbuzz(n):
    return "Fizz" * (n % 3 == 0) + "Buzz" * (n % 5 == 0) or str(n)

print("Hello from Python!")
print(", ".join(fizzbuzz(i) for i in range(1, 16)))
` },
    { id: 'javascript', n: 'JavaScript', ic: '🟨', run: 'js', ce: 'js', cm: '//', how: 'Runs in a sealed worker inside the app. Anything you draw on a canvas appears as pictures, and an animation shows the last frames it drew; tick 🖥 Show it as a web page to watch it move on the Screen.',
      ex: R`const words = ['offline', 'private', 'yours'];
console.log('Hello from JavaScript!');
console.log(words.map(w => w.toUpperCase()).join(' · '));
` },
    { id: 'html', n: 'HTML & CSS', ic: '🌐', run: 'html', ce: 'html', cm: '', how: 'Preview updates as you type. Scripts and network are disabled in the preview.',
      ex: R`<h1 style="font-family: Georgia; color: teal">Hello!</h1>
<p>Edit this page and watch the preview change.</p>
` },
    { id: 'scratch', n: 'Scratch', ic: '🐱', run: 'scratch', ce: 'scratch', cm: '//', how: 'Drag blocks onto the script, then ▶ Run on the screen: the cat moves, draws with a pen and talks. Blocks are saved as text, so a script can be shared or copied.',
      ex: R`when flag clicked
say Hello from Scratch! for 2
repeat 4
  move 60 steps
  turn 90 degrees
` },
    { id: 'sql', n: 'SQL (SQLite)', ic: '🗃️', run: 'sql', ce: 'sql', cm: '--', how: 'SQLite starts with an empty database for each run.',
      ex: R`CREATE TABLE planets (name TEXT, moons INTEGER);
INSERT INTO planets VALUES ('Mercury', 0), ('Earth', 1), ('Mars', 2), ('Jupiter', 95);
SELECT name, moons FROM planets WHERE moons > 0 ORDER BY moons DESC;
` },
    { id: 'binary', n: 'Binary & Hex', ic: '🔢', run: 'binary', cm: '#', how: 'Enter one integer per line. Use 0b for binary and 0x for hex.',
      ex: R`0b101010
0x2A
42
` },
    /* ---------- classic languages with built-in interpreters ---------- */
    { id: 'scheme', n: 'Scheme', ic: 'λ', run: 'eso', cm: ';', how: 'A built-in Scheme (core R7RS: define, lambda, let, cond, do, lists, strings, vectors, tail calls).',
      ex: R`; Scheme: recursion, lists and a named let
(define (factorial n)
  (if (= n 0) 1 (* n (factorial (- n 1)))))

(display "Hello from Scheme!") (newline)
(display (map factorial '(1 2 3 4 5 6))) (newline)
(let loop ((i 1))
  (when (<= i 3)
    (display (string-append "Round " (number->string i)))
    (newline)
    (loop (+ i 1))))
` },
    { id: 'prolog', n: 'Prolog', ic: '🦉', run: 'eso', cm: '%', how: 'A built-in Prolog: facts, rules, backtracking, cut, lists, findall, format. Runs :- initialization(main).',
      ex: R`% Prolog: facts, rules and a query that runs at start-up.
parent(tom, bob).
parent(bob, ann).
parent(bob, pat).
grandparent(X, Z) :- parent(X, Y), parent(Y, Z).

main :-
    write('Hello from Prolog!'), nl,
    forall(grandparent(tom, G), (write(G), write(' is a grandchild of tom'), nl)),
    findall(N, between(1, 5, N), Ns), sum_list(Ns, S),
    format("1 + 2 + 3 + 4 + 5 = ~w~n", [S]).

:- initialization(main).
` },
    { id: 'forth', n: 'Forth', ic: '🧱', run: 'eso', cm: '\\', how: 'A built-in Forth: colon words, IF ELSE THEN, DO LOOP, BEGIN UNTIL/WHILE REPEAT, VARIABLE, CONSTANT.',
      ex: R`\ Forth: new words are defined with : and ;
: square ( n -- n*n ) dup * ;
: squares ( n -- ) 1+ 1 do i square . loop cr ;
." Hello from Forth!" cr
5 squares
: countdown ( n -- ) begin dup . 1- dup 0= until drop ." Liftoff!" cr ;
3 countdown
` },
    { id: 'basic', n: 'BASIC', ic: '📟', run: 'eso', cm: "'", how: 'A built-in BASIC: PRINT, INPUT, LET, IF THEN ELSE, FOR NEXT, WHILE WEND, GOSUB, DIM, DATA. Line numbers are optional.',
      ex: R`10 PRINT "Hello from BASIC!"
20 FOR I = 1 TO 5
30 PRINT I; "squared is"; I * I
40 NEXT I
50 LET N$ = "Moundshroud"
60 PRINT N$; " has"; LEN(N$); "letters"
70 END
` },
    /* ---------- with tools on this PC ---------- */
    { id: 'c', n: 'C', ic: '⚙️', run: 'local', cm: '//', how: 'Compiled with GCC in the Docker sandbox.',
      ex: R`#include <stdio.h>

/* Print a small times table. */
int main(void) {
    puts("Hello from C!");
    for (int i = 1; i <= 5; i++) {
        printf("%d x 7 = %d\n", i, i * 7);
    }
    return 0;
}
` },
    { id: 'cpp', n: 'C++', ic: '➕', run: 'local', cm: '//', how: 'Compiled as C++20 with g++ in the Docker sandbox.',
      ex: R`#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> words{"Hello", "from", "C++!"};
    for (const auto& w : words) std::cout << w << ' ';
    std::cout << '\n';
    int total = 0;
    for (int n : {1, 2, 3, 4, 5}) total += n * n;
    std::cout << "Sum of squares 1..5 = " << total << '\n';
}
` },
    { id: 'masm', n: 'Assembly x64 (MASM, Windows)', ic: '🔩', run: 'local', cm: ';', how: 'Assembled with ml64.exe and linked against kernel32.lib. The entry point is main.', why: 'MASM needs the Windows C++ toolchain, which is not in the Docker image, and the app does not run native code as your Windows user.',
      ex: R`; x64 Windows assembly (MASM): write one line with the Windows API, then exit.
extrn GetStdHandle : proc
extrn WriteFile : proc
extrn ExitProcess : proc

.data
msg     db "Hello from x64 assembly!", 13, 10
msglen  equ $ - msg
written dd ?

.code
main proc
    sub     rsp, 40                 ; shadow space, keeps the stack aligned
    mov     ecx, -11                ; STD_OUTPUT_HANDLE
    call    GetStdHandle
    mov     rcx, rax                ; the handle
    lea     rdx, msg                ; the text
    mov     r8d, msglen             ; its length
    lea     r9, written             ; where Windows writes the byte count
    mov     qword ptr [rsp+32], 0   ; no OVERLAPPED structure
    call    WriteFile
    xor     ecx, ecx                ; exit code 0
    call    ExitProcess
main endp
end
` },
    { id: 'rust', n: 'Rust', ic: '🦀', run: 'local', cm: '//', how: 'Compiled with rustc in the Docker sandbox (edition 2021).',
      ex: R`fn fib(n: u64) -> u64 {
    if n < 2 { n } else { fib(n - 1) + fib(n - 2) }
}

fn main() {
    println!("Hello from Rust!");
    let fibs: Vec<u64> = (0..10).map(fib).collect();
    println!("First ten Fibonacci numbers: {:?}", fibs);
}
` },
    { id: 'csharp', n: 'C#', ic: '🎯', run: 'local', cm: '//', how: 'Compiled with the .NET SDK in the Docker sandbox. Top-level statements and the common usings work.',
      ex: R`// C# top-level statements: no class or Main needed.
var names = new[] { "Ada", "Grace", "Linus" };
Console.WriteLine("Hello from C#!");
foreach (var (name, i) in names.Select((n, i) => (n, i)))
    Console.WriteLine($"{i + 1}. {name} has {name.Length} letters");
Console.WriteLine($"Longest: {names.MaxBy(n => n.Length)}");
` },
    { id: 'fsharp', n: 'F#', ic: '🔷', run: 'local', cm: '//', how: 'Runs as an F# script with the .NET SDK (dotnet fsi).', why: 'F# is not in the Docker image, and the app does not run native code as your Windows user.',
      ex: R`let square x = x * x
printfn "Hello from F#!"
[1..5] |> List.map square |> List.iter (printfn "%d")
printfn "Sum of squares: %d" ([1..5] |> List.sumBy square)
` },
    { id: 'vbnet', n: 'Visual Basic (.NET)', ic: '🅱️', run: 'local', cm: "'", how: 'Compiled with the .NET SDK\'s Visual Basic compiler.', why: 'Visual Basic is not in the Docker image, and the app does not run native code as your Windows user.',
      ex: R`Module Program
    Sub Main()
        Console.WriteLine("Hello from Visual Basic!")
        For i As Integer = 1 To 5
            Console.WriteLine(i & " squared is " & (i * i))
        Next
    End Sub
End Module
` },
    { id: 'typescript', n: 'TypeScript', ic: '🔷', run: 'local', cm: '//', how: 'Compiled with tsc and run by Node.js in the Docker sandbox.',
      ex: R`interface Planet { name: string; moons: number }

const planets: Planet[] = [
  { name: "Earth", moons: 1 },
  { name: "Mars", moons: 2 },
  { name: "Jupiter", moons: 95 },
];
const describe = (p: Planet): string => p.name + " has " + p.moons + (p.moons === 1 ? " moon" : " moons");

console.log("Hello from TypeScript!");
planets.forEach(p => console.log(describe(p)));
` },
    { id: 'nodejs', n: 'JavaScript (Node.js)', ic: '🟩', run: 'local', cm: '//', how: 'Runs with Node.js.', why: 'Node.js is not in the Docker image, and the app does not run native code as your Windows user.',
      ex: R`const os = require('os');
console.log('Hello from Node.js ' + process.version + '!');
console.log('This PC has ' + os.cpus().length + ' processor threads.');
` },
    { id: 'powershell', n: 'PowerShell', ic: '💠', run: 'local', cm: '#', term: 'powershell', how: 'Opens the PowerShell terminal from the Terminal playground, a fully simulated Windows PC: nothing runs on this PC. The same shell also runs in Windows Sandbox or Docker when they are set up (see the Terminal playground).',
      ex: R`Write-Output "Hello from PowerShell!"
1..5 | ForEach-Object { "{0} squared is {1}" -f $_, ($_ * $_) }
$today = Get-Date
Write-Output ("Today is " + $today.DayOfWeek)
` },
    { id: 'batch', n: 'Batch (cmd.exe)', ic: '🪟', run: 'local', cm: 'REM', term: 'cmd', how: 'Opens the Command Prompt terminal from the Terminal playground, a fully simulated Windows PC: nothing runs on this PC. Batch files also run in Windows Sandbox when it is set up (see the Terminal playground).',
      ex: R`@echo off
echo Hello from a Windows batch file!
for /L %%i in (1,1,5) do echo Count %%i
set /a total=6*7
echo 6 times 7 is %total%
` },
    { id: 'vbscript', n: 'VBScript', ic: '📜', run: 'local', cm: "'", how: 'Runs with Windows Script Host (cscript) inside Windows Sandbox (Windows only).',
      ex: R`WScript.Echo "Hello from VBScript!"
Dim i
For i = 1 To 5
    WScript.Echo i & " cubed is " & (i ^ 3)
Next
` },
    { id: 'jscript', n: 'JScript (Windows Script Host)', ic: '📜', run: 'local', cm: '//', how: 'Runs with Windows Script Host (cscript) inside Windows Sandbox (Windows only). This is the 1990s JavaScript dialect.',
      ex: R`WScript.Echo("Hello from JScript!");
for (var i = 1; i <= 5; i++) {
    WScript.Echo(i + " doubled is " + (i * 2));
}
` },
    { id: 'bash', n: 'Bash', ic: '🐚', run: 'local', ce: 'sh', cm: '#', term: 'bash', how: 'Opens the Bash terminal from the Terminal playground, a fully simulated Linux PC: nothing runs on this PC. Bash scripts also run in the Docker sandbox when it is set up (see the Terminal playground).',
      ex: R`#!/bin/bash
echo "Hello from Bash!"
for i in 1 2 3 4 5; do
  echo "$i squared is $((i * i))"
done
name="Moundshroud"
echo "$name has ${'${'}#name} letters"
` },
    { id: 'perl', n: 'Perl', ic: '🐪', run: 'local', cm: '#', how: 'Runs with Perl.', why: 'Perl is not in the Docker image, and the app does not run native code as your Windows user.',
      ex: R`use strict;
use warnings;

print "Hello from Perl!\n";
my @words = qw(banana fig cherry);
for my $w (sort { length($a) <=> length($b) } @words) {
    printf "%-7s %d letters\n", $w, length $w;
}
(my $backwards = "The quick brown fox") =~ s/(\w+)/reverse $1/ge;
print "$backwards\n";
` },
    { id: 'awk', n: 'AWK', ic: '🦅', run: 'local', cm: '#', how: 'Runs with GNU AWK. It reads the Input box line by line.', why: 'AWK is not in the Docker image, and the app does not run native code as your Windows user.',
      inp: 'Ada 91\nGrace 87\nLinus 78\n',
      ex: R`# AWK reads the Input box line by line: a name and a score.
BEGIN { print "Hello from AWK!" }
{ total += $2; print $1 " scored " $2 }
END { if (NR) printf "Average: %.1f\n", total / NR }
` },
    { id: 'sed', n: 'sed', ic: '✂️', run: 'local', cm: '#', how: 'Runs with GNU sed. It edits the Input box text line by line.', why: 'sed is not in the Docker image, and the app does not run native code as your Windows user.',
      inp: 'The colour of the sky\nA colourful day\n',
      ex: R`# sed edits the Input box text line by line.
s/colour/color/g
s/^/> /
` },
    /* ---------- in the Docker image only ---------- */
    { id: 'go', n: 'Go', ic: '🐹', run: 'docker', cm: '//', ex: R`package main

import "fmt"

func main() {
    fmt.Println("Hello from Go!")
    for i := 1; i <= 3; i++ {
        fmt.Printf("%d x 3 = %d\n", i, i*3)
    }
}
` },
    { id: 'java', n: 'Java', ic: '☕', run: 'docker', cm: '//', ex: R`class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
        int sum = 0;
        for (int i = 1; i <= 10; i++) sum += i;
        System.out.println("1 + 2 + ... + 10 = " + sum);
    }
}
` },
    { id: 'kotlin', n: 'Kotlin', ic: '🟪', run: 'docker', cm: '//', ex: R`fun main() {
    println("Hello from Kotlin!")
    val squares = (1..5).map { it * it }
    println("Squares: $squares")
}
` },
    { id: 'swift', n: 'Swift', ic: '🐦', run: 'docker', cm: '//', ex: R`let names = ["Ada", "Grace", "Linus"]
print("Hello from Swift!")
for (i, name) in names.enumerated() {
    print("\(i + 1). \(name)")
}
` },
    { id: 'php', n: 'PHP', ic: '🐘', run: 'docker', cm: '//', ex: R`<?php
echo "Hello from PHP!\n";
foreach ([1, 2, 3] as $n) {
    echo "$n squared is " . ($n * $n) . "\n";
}
` },
    { id: 'ruby', n: 'Ruby', ic: '💎', run: 'docker', cm: '#', ex: R`puts "Hello from Ruby!"
(1..3).each { |n| puts "#{n} squared is #{n * n}" }
` },
    { id: 'lua', n: 'Lua', ic: '🌙', run: 'docker', cm: '--', ex: R`print("Hello from Lua!")
for i = 1, 3 do
  print(i .. " squared is " .. i * i)
end
` },
    { id: 'holyc', n: 'HolyC', ic: '✝️', run: 'docker', cm: '//', how: 'Uses hcc and its HolyC standard library.', ex: R`U0 Main()
{
    "Hello from HolyC!\n";
    I64 i;
    for (i = 1; i <= 3; i++)
        "%d squared is %d\n", i, i * i;
}
Main;
` },
    { id: 'asm', n: 'Assembly x86-64 (NASM, Linux)', ic: '🔩', run: 'docker', cm: ';', how: 'Uses NASM x86-64 syntax and the Linux calling convention.', ex: R`section .rodata
    msg db "Hello from NASM!", 10
    len equ $ - msg

section .text
    global _start
_start:
    mov eax, 1          ; write
    mov edi, 1          ; to stdout
    lea rsi, [rel msg]
    mov edx, len
    syscall
    mov eax, 60         ; exit
    xor edi, edi
    syscall
` },
    /* ---------- not runnable here (examples to read and copy) ---------- */
    { id: 'haskell', n: 'Haskell', ic: '🎓', run: 'none', cm: '--', ex: R`main :: IO ()
main = do
  putStrLn "Hello from Haskell!"
  print (map (^ 2) [1 .. 5])
  print (sum [x | x <- [1 .. 100], even x])
` },
    { id: 'zig', n: 'Zig', ic: '⚡', run: 'none', cm: '//', ex: R`const std = @import("std");

pub fn main() void {
    std.debug.print("Hello from Zig!\n", .{});
    var i: u32 = 1;
    while (i <= 3) : (i += 1) {
        std.debug.print("{d} squared is {d}\n", .{ i, i * i });
    }
}
` },
    { id: 'nim', n: 'Nim', ic: '👑', run: 'none', cm: '#', ex: R`echo "Hello from Nim!"
for i in 1..3:
  echo i, " squared is ", i * i
` },
    { id: 'commonlisp', n: 'Common Lisp', ic: '🧠', run: 'none', cm: ';', ex: R`(format t "Hello from Common Lisp!~%")
(dotimes (i 3)
  (format t "~a squared is ~a~%" (1+ i) (* (1+ i) (1+ i))))
` },
    { id: 'clojure', n: 'Clojure', ic: '🌀', run: 'none', cm: ';', ex: R`(println "Hello from Clojure!")
(println (map #(* % %) (range 1 6)))
` },
    { id: 'erlang', n: 'Erlang', ic: '📞', run: 'none', cm: '%', ex: R`-module(main).
-export([main/1]).

main(_) ->
    io:format("Hello from Erlang!~n"),
    lists:foreach(fun(N) -> io:format("~p squared is ~p~n", [N, N * N]) end, [1, 2, 3]).
` },
    { id: 'elixir', n: 'Elixir', ic: '💧', run: 'none', cm: '#', ex: R`IO.puts("Hello from Elixir!")
Enum.each(1..3, fn n -> IO.puts("#{n} squared is #{n * n}") end)
` },
    { id: 'ocaml', n: 'OCaml', ic: '🐫', run: 'none', cm: '(*', ex: R`let () =
  print_endline "Hello from OCaml!";
  List.iter (fun n -> Printf.printf "%d squared is %d\n" n (n * n)) [1; 2; 3]
` },
    { id: 'r', n: 'R', ic: '📊', run: 'none', cm: '#', ex: R`cat("Hello from R!\n")
x <- 1:5
print(x^2)
cat("Mean:", mean(x), "\n")
` },
    { id: 'julia', n: 'Julia', ic: '🟣', run: 'none', cm: '#', ex: R`println("Hello from Julia!")
for i in 1:3
    println("$i squared is $(i^2)")
end
` },
    { id: 'fortran', n: 'Fortran', ic: '🧮', run: 'none', cm: '!', ex: R`program hello
  implicit none
  integer :: i
  print *, 'Hello from Fortran!'
  do i = 1, 3
    print '(I0, A, I0)', i, ' squared is ', i * i
  end do
end program hello
` },
    { id: 'cobol', n: 'COBOL', ic: '🏦', run: 'none', cm: '*>', ex: R`       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 I PIC 9 VALUE 1.
       PROCEDURE DIVISION.
           DISPLAY "Hello from COBOL!".
           PERFORM VARYING I FROM 1 BY 1 UNTIL I > 3
               DISPLAY "Count " I
           END-PERFORM.
           STOP RUN.
` },
    { id: 'pascal', n: 'Pascal', ic: '📐', run: 'none', cm: '//', ex: R`program Hello;
var
  i: Integer;
begin
  WriteLn('Hello from Pascal!');
  for i := 1 to 3 do
    WriteLn(i, ' squared is ', i * i);
end.
` },
    { id: 'ada', n: 'Ada', ic: '🛡️', run: 'none', cm: '--', ex: R`with Ada.Text_IO; use Ada.Text_IO;

procedure Hello is
begin
   Put_Line ("Hello from Ada!");
   for I in 1 .. 3 loop
      Put_Line (Integer'Image (I) & " squared is" & Integer'Image (I * I));
   end loop;
end Hello;
` },
    { id: 'd', n: 'D', ic: '🅳', run: 'none', cm: '//', ex: R`import std.stdio;

void main()
{
    writeln("Hello from D!");
    foreach (i; 1 .. 4)
        writefln("%d squared is %d", i, i * i);
}
` },
    { id: 'crystal', n: 'Crystal', ic: '🔮', run: 'none', cm: '#', ex: R`puts "Hello from Crystal!"
(1..3).each do |n|
  puts "#{n} squared is #{n * n}"
end
` },
    { id: 'scala', n: 'Scala', ic: '🪜', run: 'none', cm: '//', ex: R`@main def hello(): Unit =
  println("Hello from Scala!")
  (1 to 3).foreach(n => println(s"$n squared is ${'${'}n * n}"))
` },
    { id: 'dart', n: 'Dart', ic: '🎯', run: 'none', cm: '//', ex: R`void main() {
  print('Hello from Dart!');
  for (var i = 1; i <= 3; i++) {
    print('$i squared is ${'${'}i * i}');
  }
}
` },
    { id: 'wat', n: 'WebAssembly text (WAT)', ic: '🧩', run: 'none', cm: ';;', why: 'The app runs WebAssembly, but it has no WAT-to-binary assembler (such as wabt) to turn this text into a module.', ex: R`(module
  (import "env" "print" (func $print (param i32)))
  (func $square (param $n i32) (result i32)
    local.get $n
    local.get $n
    i32.mul)
  (func (export "main")
    (call $print (call $square (i32.const 7)))))
` },
    /* ---------- esoteric ---------- */
    { id: 'bf', n: 'Brainfuck', ic: '🧠', run: 'eso', how: 'Eight symbols (+ - < > [ ] . ,) on 65,536 byte cells. Everything else is a comment.', ex: "Prints Hello Moundshroud with one small loop for each letter\nOnly the eight symbols count so these words are ignored\n\n>++++++++[<+++++++++>-]<.>+++++[<+++++>-]<++++.+++++++..+++.\n>++++++++[<-------->-]<---.------------.>+++++++[<++++++>-]<\n+++.>++++++[<+++++>-]<++++.++++++.-------.----------.+++++++\n++++++++.-----------.++++++++++.---.++++++.>++++[<---->-]<-.\n>++++++++[<-------->-]<---.>+++++[<---->-]<---.\n" },
    { id: 'ook', n: 'Ook!', ic: '🦧', run: 'eso', how: 'Brainfuck for orangutans: each pair of Ook. Ook? Ook! words is one Brainfuck symbol.', ex: "Ook. Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook.\nOok. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook.\nOok. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook.\nOok. Ook. Ook. Ook. Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook.\nOok. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook.\nOok. Ook. Ook! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook. Ook.\nOok. Ook. Ook. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook. Ook.\nOok. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook? Ook! Ook!\nOok? Ook! Ook? Ook. Ook. Ook. Ook. Ook. Ook! Ook. Ook! Ook!\nOok! Ook! Ook! Ook! Ook! Ook! Ook! Ook. Ook. Ook? Ook. Ook.\nOok. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook.\nOok. Ook. Ook. Ook. Ook! Ook? Ook? Ook. Ook! Ook! Ook! Ook!\nOok! Ook! Ook! Ook! Ook! Ook! Ook! Ook! Ook! Ook! Ook! Ook!\nOok. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook! Ook! Ook! Ook!\nOok! Ook. Ook. Ook? Ook. Ook. Ook. Ook. Ook. Ook. Ook. Ook.\nOok. Ook. Ook! Ook? Ook? Ook. Ook! Ook! Ook! Ook! Ook! Ook!\nOok! Ook! Ook. Ook? Ook! Ook! Ook? Ook! Ook? Ook. Ook! Ook!\nOok! Ook! Ook! Ook! Ook! Ook.\n" },
    { id: 'cow', n: 'COW', ic: '🐄', run: 'eso', how: 'Twelve moos: Brainfuck plus a register, number output and "run the cell as an instruction".', ex: "moO MoO MoO MoO MoO MoO MoO MoO MoO MoO MOO mOo\nMoO MoO MoO MoO MoO MoO MoO MoO moO MOo moo mOo\nMoO MoO MoO MoO MoO Moo moO MoO MoO MoO MoO MoO\nMoO MOO mOo MoO MoO MoO MoO MoO moO MOo moo mOo\nMoO MoO MoO MoO Moo Moo moO MoO MoO MoO MoO MoO\nMoO MoO MoO MoO MOO mOo MOo MOo MOo MOo MOo MOo\nMOo MOo moO MOo moo mOo MOo MOo MOo MOo MOo MOo\nMoo moO MoO MoO MoO MoO MoO MOO mOo MOo MOo MOo\nMOo moO MOo moo mOo MOo MOo MOo Moo\n" },
    { id: 'befunge93', n: 'Befunge-93', ic: '🧭', run: 'eso', how: 'The program is an 80 by 25 grid. The pointer moves in 2D and wraps around the edges.',
      ex: R`5>:.1-:#v_$55+,"!ffo tfiL">:#,_@
 ^      <
` },
    { id: 'funge98', n: 'Befunge-98 (Funge-98)', ic: '🧭', run: 'eso', how: 'Befunge-98 core: unlimited grid, ; comments, \' to fetch a character, k to repeat. No fingerprints or stack stacks.',
      ex: R`;Funge-98: k repeats the next instruction;"!89-egnuF ,olleH">:#,_a,'*4k:5k,a,@
` },
    { id: 'fish', n: '><> (Fish)', ic: '🐟', run: 'eso', how: 'A 2D stack language: the fish swims through the grid and wraps around the edges.',
      ex: R`a"!hsiF ,olleH"v
               >l?!;o
` },
    { id: 'malbolge', n: 'Malbolge', ic: '😈', run: 'eso', how: 'Built to be the hardest language: code encrypts itself as it runs. This example was found by a search program.', ex: "'&%$#\"!~6;4381U/.3,+*)('&%*#Ghgfedc@a`_^]\\[ZYXtsrkj0{" },
    { id: 'piet', n: 'Piet', ic: '🎨', run: 'eso', how: 'Programs are pictures. Here each letter is one coloured square: r y g c b m light, R Y G C B M normal, 1 to 6 dark, . white, # black.', ex: "R################################################G\nRRRRRRRRRRRRRRR1MMMMMMMMMMMMMMMMMMMMM6BBBBBBB5CC4G\nRRRRRRRRRRRRRR##MMMMMMMMMMMMMMMMMMMMM#BBBBBBB#CC#G\nRRRRRRRRRRRRRR##MMMMMMMMMMMMMMMMMMMMM#BBBBBBB#CC#G\nRRRRRRRRRRRRRR##MMMMMMMMMMMMMMMMMMMMM#BBBBBB##CC#G\nRRRRRRRRRRRRRR##MMMMMMMMMMMMMMMMMMMMM#BBBBBB##CC#G\n" },
    { id: 'chicken', n: 'Chicken', ic: '🐔', run: 'eso', how: 'Each line is one instruction, numbered by how many times it says chicken. The top of the stack is printed at the end.', ex: "chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken\nchicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken\nchicken chicken chicken chicken\nchicken chicken chicken chicken chicken chicken chicken chicken chicken\nchicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken\nchicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken chicken\nchicken chicken chicken chicken\nchicken chicken chicken chicken chicken chicken chicken chicken chicken\nchicken chicken\n" },
    { id: 'intercal', n: 'INTERCAL', ic: '🙏', run: 'eso', how: 'C-INTERCAL without its system library. Say PLEASE in 1/5 to 1/3 of the statements, or the compiler complains.', ex: "        DO ,1 <- #17\n        DO ,1 SUB #1 <- #238\n        PLEASE DO ,1 SUB #2 <- #108\n        DO ,1 SUB #3 <- #112\n        DO ,1 SUB #4 <- #0\n        DO ,1 SUB #5 <- #64\n        PLEASE DO ,1 SUB #6 <- #194\n        DO ,1 SUB #7 <- #48\n        DO ,1 SUB #8 <- #114\n        DO ,1 SUB #9 <- #32\n        PLEASE DO ,1 SUB #10 <- #72\n        DO ,1 SUB #11 <- #136\n        DO ,1 SUB #12 <- #88\n        DO ,1 SUB #13 <- #136\n        PLEASE DO ,1 SUB #14 <- #64\n        DO ,1 SUB #15 <- #80\n        DO ,1 SUB #16 <- #174\n        DO ,1 SUB #17 <- #52\n        PLEASE READ OUT ,1\n        DO .1 <- #2026\n        DO READ OUT .1\n        PLEASE GIVE UP\n" },
    { id: 'spl', n: 'Shakespeare (SPL)', ic: '🎭', run: 'eso', how: 'Programs are plays. Characters hold numbers; nouns are 1 or -1 and each adjective doubles them.',
      ex: R`The Tiny Greeting.

Romeo, a young man of few words.
Juliet, a lady who listens.

                    Act I: The only act.

                    Scene I: Romeo says hello.

[Enter Romeo and Juliet]

Romeo:
 You are as lovely as the sum of a sweet beautiful lovely fair gentle warm flower and a happy golden noble rose.
 Speak your mind!
 You are as good as the sum of yourself and the sum of a big black purple furry tiny cow and a cat.
 Speak your mind!
 You are as good as the sum of a happy healthy honest king and a fine pony.
 Speak your mind!

[Exeunt]
` },
    { id: 'chef', n: 'Chef', ic: '👨‍🍳', run: 'eso', how: 'Programs are recipes. Ingredients are numbers, mixing bowls are stacks, and liquids print as letters.',
      ex: R`Hello Soup.

A light soup that greets the table.

Ingredients.
72 ml hot water
105 ml milk
33 ml lemon juice
10 ml vinegar

Method.
Put vinegar into the mixing bowl.
Put lemon juice into the mixing bowl.
Put milk into the mixing bowl.
Put hot water into the mixing bowl.
Pour contents of the mixing bowl into the baking dish.

Serves 1.
` },
    { id: 'whitespace', n: 'Whitespace', ic: '⬜', run: 'eso', how: 'Only spaces, tabs and line breaks count, so the words in this example are comments. Select all to see the tabs.', ex: "push_H   \t  \t   \nprint\t\n  push_i   \t\t \t  \t\nprint\t\n  push_,   \t \t\t  \nprint\t\n  push_space   \t     \nprint\t\n  push_W   \t \t \t\t\t\nprint\t\n  push_h   \t\t \t   \nprint\t\n  push_i   \t\t \t  \t\nprint\t\n  push_t   \t\t\t \t  \nprint\t\n  push_e   \t\t  \t \t\nprint\t\n  push_s   \t\t\t  \t\t\nprint\t\n  push_p   \t\t\t    \nprint\t\n  push_a   \t\t    \t\nprint\t\n  push_c   \t\t   \t\t\nprint\t\n  push_e   \t\t  \t \t\nprint\t\n  push_!   \t    \t\nprint\t\n  push_newline   \t \t \nprint\t\n  end\n\n\n" },
    { id: 'unlambda', n: 'Unlambda', ic: '🔣', run: 'eso', how: 'Functions only: ` applies one function to another. .x prints x, r prints a new line, # starts a comment.', ex: "# Unlambda: each ` applies a function; .x prints x and returns its argument\n`````````````````.H.e.l.l.o.,. .U.n.l.a.m.b.d.a.!ri\n" },
    { id: 'lolcode', n: 'LOLCODE', ic: '🐱', run: 'eso', how: 'LOLCODE 1.2: HAI, VISIBLE, I HAS A, loops, O RLY? and functions.',
      ex: R`HAI 1.2
  BTW count to five and say whether each number is odd or even
  I HAS A name ITZ "Moundshroud"
  VISIBLE "HAI, " name "!"
  IM IN YR loop UPPIN YR n TIL BOTH SAEM n AN 5
    I HAS A num ITZ SUM OF n AN 1
    BOTH SAEM MOD OF num AN 2 AN 0
    O RLY?
      YA RLY, VISIBLE num " IZ EVEN"
      NO WAI, VISIBLE num " IZ ODD"
    OIC
  IM OUTTA YR loop
  HOW IZ I square YR x
    FOUND YR PRODUKT OF x AN x
  IF U SAY SO
  VISIBLE "7 SQUARED IZ " I IZ square YR 7 MKAY
KTHXBYE
` },
    { id: 'arnoldc', n: 'ArnoldC', ic: '💪', run: 'eso', how: 'Every keyword is an action-film one-liner. Values are whole numbers.',
      ex: R`IT'S SHOWTIME
TALK TO THE HAND "Countdown"
HEY CHRISTMAS TREE count
YOU SET US UP 5
STICK AROUND count
TALK TO THE HAND count
GET TO THE CHOPPER count
HERE IS MY INVITATION count
GET DOWN 1
ENOUGH TALK
CHILL
DO IT NOW liftoff
YOU HAVE BEEN TERMINATED

LISTEN TO ME VERY CAREFULLY liftoff
TALK TO THE HAND "Liftoff!"
HASTA LA VISTA, BABY
` },
    { id: 'rockstar', n: 'Rockstar', ic: '🎸', run: 'eso', how: 'Rockstar core: programs read like song lyrics. Poetic numbers count letters; blank lines end blocks.',
      ex: R`(a function, a loop and a shout)
Midnight takes your dream
Give back your dream times your dream

The night is young
My heart is nothing
Until my heart is the night
Build my heart up
Say my heart

Put Midnight taking 7 into the answer
Shout "Seven squared is " plus the answer
` },
    { id: 'emojicode', n: 'Emojicode', ic: '😀', run: 'eso', how: 'A part of Emojicode: printing, numbers, variables, conditions and loops. No classes or packages.',
      ex: R`💭 Emojicode: a greeting, a loop and a condition
🏁 🍇
  😀 🔤Hello from Emojicode!🔤❗️
  0 ➡️ 🖍🆕 total
  🔂 i 🆕⏩ 1 6❗️ 🍇
    total ⬅️➕ i
    ↪️ i 🚮 2 🙌 0 🍇
      😀 🔤🧲i🧲 is even🔤❗️
    🍉
    🙅 🍇
      😀 🔤🧲i🧲 is odd🔤❗️
    🍉
  🍉
  😀 🔤The total is 🧲total🧲🔤❗️
🍉
` },
    { id: 'false', n: 'FALSE', ic: '🎲', run: 'eso', how: 'A tiny stack language from 1993: [ ] makes a function, ! runs it, # is a while loop, a to z are variables.',
      ex: R`{ FALSE: print the squares of 1 to 5 }
1i:                 { i := 1 }
[i;6=~]             { while i is not 6 }
[ i;i;*. " "        {   print i * i }
  i;1+i:            {   i := i + 1 }
]#
10,"Done!"
` },
    { id: 'thue', n: 'Thue', ic: '🔁', run: 'eso', how: 'String rewriting: rules left::=right fire in any order until none match. A right side starting with ~ prints.',
      ex: R`1::=~Hello
[a::=[2
2::=~from Thue!
::=
[1a]
` },
    { id: 'underload', n: 'Underload', ic: '🥞', run: 'eso', how: 'A stack of programs: (x) pushes, : copies, * joins, S prints, ^ runs the top one.',
      ex: R`(Hello, Underload!
)S(la):::***S(
)S
` },
    { id: 'deadfish', n: 'Deadfish', ic: '🐠', run: 'eso', how: 'Four commands: i adds 1, d takes 1, s squares, o prints. 256 and -1 reset to 0.',
      ex: R`iiso so so
` },
    { id: 'slashes', n: '/// (Slashes)', ic: '⁄', run: 'eso', how: 'The only command is /pattern/replacement/, applied to the rest of the program. \\ escapes the next character.',
      ex: R`/X/Hello//Y/slashes/X, Y!
` },
    { id: 'brainflak', n: 'Brain-Flak', ic: '🧩', run: 'eso', how: 'Only brackets: () is 1, (x) pushes x, {} pops, {x} loops, [] is the height, <> swaps stacks. # -A prints letters.',
      ex: R`# Brain-Flak: push 10, then add 9 + 8 + ... + 1 with a loop
(()()()()()()()()()())
({({}[()])}{})
` },
    { id: 'hq9', n: 'HQ9+', ic: '🍺', run: 'eso', how: 'H says hello, Q prints the program, 9 sings 99 bottles, + adds one to a counter nobody can read.',
      ex: R`HQ
` },
    { id: 'fractran', n: 'FRACTRAN', ic: '➗', run: 'eso', how: 'A list of fractions: multiply by the first one that gives a whole number, until none does.',
      ex: R`# Addition: start with 2^a x 3^b and the program 3/2 leaves 3^(a+b).
start 72
3/2
` },
    { id: 'bct', n: 'Bitwise Cyclic Tag', ic: '🔄', run: 'eso', how: 'Program bits on line 1, data bits on line 2. 0 deletes a data bit; 1x appends x when the first data bit is 1.',
      ex: R`100
101
` },
    { id: 'whenever', n: 'Whenever', ic: '🎰', run: 'eso', how: 'The lines run in a random order. defer (condition) waits; N(line) counts how often a line is still due.',
      ex: R`1 print("Hip");
2 defer (N(1) > 0) print("Hip");
3 defer (N(1) + N(2) > 0) print("Hooray!");
` },
    { id: 'hexagony', n: 'Hexagony', ic: '⬡', run: 'none', why: 'Hexagony\'s hexagonal grid and memory have no interpreter here yet, so this example is not checked.',
      ex: R`H;i;@
` },
    { id: 'velato', n: 'Velato', ic: '🎼', run: 'none', why: 'Velato programs are MIDI files: the intervals between notes are the instructions. The Playground edits text, so it cannot run them.',
      ex: R`Velato programs are music, saved as MIDI files.
Each note's interval from the current root note picks a command,
so a program is written in a music editor, not as text.
` },
  ];
  /* Windows-native scripts run in Windows Sandbox (lib/code-sandbox-windows.js), never on the host. */
  const SANDBOX = ['powershell', 'batch', 'vbscript', 'jscript'];
  /* The HTML preview runs in a sandboxed frame. This CSP also blocks every network request, so a page cannot
     load a remote image or call back out. Scripts are off in the lessons preview; the terminal's runner can turn
     them on, still with no network. */
  const PREVIEW_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  const PREVIEW_CSP_SCRIPTS = PREVIEW_CSP.replace("script-src 'none'", "script-src 'unsafe-inline' 'unsafe-eval' blob: data:");
  function previewDoc(code, scripts) {
    const csp = scripts ? PREVIEW_CSP_SCRIPTS : PREVIEW_CSP;
    const tag = '<meta http-equiv="Content-Security-Policy" content="' + csp.replace(/"/g, '&quot;') + '">';
    const text = String(code == null ? '' : code);
    const doctype = /^\s*<!doctype[^>]*>/i.exec(text);
    if (doctype) {
      const at = doctype.index + doctype[0].length;
      return text.slice(0, at) + tag + text.slice(at);
    }
    return tag + text;
  }
  const byId = id => L.find(x => x.id === id);
  /* Where a language runs right now, and, when it cannot run, a sentence a learner can act on. Every language always
     gets an answer: app, mini, eso, pc, docker, or none with a reason. `checking` is only true until the status call
     answers. code-lessons.js and the tests both use this, so a language can never end up with a blank explanation. */
  const MINI = ['scheme', 'prolog', 'forth', 'basic'];
  /* SAFETY INVARIANT: no Playground program ever leaves the browser. Native languages are refused even when Docker or
     Windows Sandbox is installed, because any host-side execution would break the promise that Playground code cannot
     touch the PC. Browser languages (Python, JavaScript, SQL, HTML, Scratch, the classic interpreters) are unaffected. */
  const BROWSER_ONLY = true;
  /* these open the Terminal playground instead of the code editor: the shell is simulated, so it is safe and always there */
  const SHELLS = L.filter(l => l.term).reduce((all, l) => { all[l.id] = l.term; return all; }, {});
  function route(l, status) {
    if (!l) return { g: 'none', why: 'That language is not in the Playground.' };
    if (['py', 'js', 'html', 'sql', 'binary', 'scratch'].includes(l.run)) return { g: 'app' };
    if (l.run === 'eso') return { g: MINI.includes(l.id) ? 'mini' : 'eso' };
    if (BROWSER_ONLY) {
      return { g: 'none', why: 'Native languages are disabled in this build. The Playground runs everything inside the browser sandbox, so no program you type here can reach your PC.' };
    }
    if (!status) return { g: 'none', checking: true, why: 'Checking which safe sandboxes are available…' };
    if (status.failed) {
      return { g: 'none', why: 'The safe-sandbox check could not be read. Reload the page, or open “Safe runtime setup” below.' };
    }
    const backend = status.backend && status.backend[l.id];
    if (backend) return { g: backend === 'docker' ? 'docker' : 'pc', sandbox: backend };
    const dk = status.docker || {};
    const onPc = SANDBOX.includes(l.id), inDocker = DOCKER.includes(l.id);
    const dockerWhy = dk.installed
      ? (!dk.running ? 'Docker is installed, but its engine is not running.' : 'Docker is running, but the Playground image is not built.')
      : 'Docker is not installed.';
    if (onPc && !inDocker) return { g: 'none', why: 'Windows Sandbox is not turned on. This Windows-only language is refused rather than run as your Windows user.' };
    if (inDocker && !onPc) return { g: 'none', why: dockerWhy + (dk.installed ? '' : ' The app does not run native code as your Windows user.') };
    if (onPc && inDocker) return { g: 'none', why: 'Windows Sandbox is not turned on, and ' + dockerWhy.charAt(0).toLowerCase() + dockerWhy.slice(1) };
    return { g: 'none', why: l.why || NOTOOL };
  }
  const api = { GROUPS, LANGS: L, DOCKER, SANDBOX, NOTOOL, BROWSER_ONLY, PREVIEW_CSP, PREVIEW_CSP_SCRIPTS, previewDoc, byId, route, MINI, SHELLS };
  root.PlayLangs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
