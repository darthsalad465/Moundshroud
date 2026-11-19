// Difficulty for the Entertainment games that did not have it. A game listed here gets an Easy / Normal / Hard bar in its header (play.js)
// and reads api.level (0, 1 or 2) when it starts. The choice is saved per game. Games that already had their own level box (Checkers, Othello, Pong,
// Tic-Tac-Toe, Connect Four, Memory, Minesweeper, Sudoku, Chess, Imperium) keep it.
(() => {
  const P = A.play; if (!P) return;
  const D = (tip, labels) => ({ tip, labels });
  Object.assign(P.diffs, {
    snake: D('Starting speed and how fast it speeds up', ['Slow', 'Normal', 'Fast']),
    breakout: D('Lives and ball speed: 5 lives, 3 lives or 2 lives', ['Easy', 'Normal', 'Hard']),
    tetris: D('How fast the blocks fall', ['Easy', 'Normal', 'Hard']),
    flap: D('Gap size and pipe speed', ['Easy', 'Normal', 'Hard']),
    simon: D('How fast the pattern plays', ['Slow', 'Normal', 'Fast']),
    whack: D('How long each mole stays up', ['Easy', 'Normal', 'Hard']),
    wordguess: D('Number of tries: 8, 6 or 5', ['8 tries', '6 tries', '5 tries']),
    hangman: D('Easy starts with two letters shown; Hard gives you only 5 lives', ['Easy', 'Normal', 'Hard']),
    mastermind: D('Number of guesses: 12, 10 or 8', ['12 guesses', '10 guesses', '8 guesses']),
    battleship: D('How smart the computer is at finding your ships', ['Easy', 'Normal', 'Hard']),
    go: D('How hard the computer thinks', ['Easy', 'Normal', 'Hard']),
    gomoku: D('How well the computer attacks and defends', ['Easy', 'Normal', 'Hard']),
    mancala: D('How many moves ahead the computer looks', ['Easy', 'Normal', 'Hard']),
    backgammon: D('How well the computer chooses its moves', ['Easy', 'Normal', 'Hard']),
    hearts: D('How carefully the computer passes and plays', ['Easy', 'Normal', 'Hard']),
    bastion: D('Starting gold, lives and how tough the enemies are', ['Easy', 'Normal', 'Hard']),
    modelmon: D('How well the computer chooses its moves: relaxed, sensible, or ruthless', ['Easy', 'Normal', 'Hard'])
  });
})();
