// Lessons, openings and endgames for the Chess Academy. Positions are checked by a script (legal moves, mates, engine agreement).
window.CHESS_STUDY = (() => {
  const endgames = [
    { id: 'kq', name: 'King and queen vs king', fen: '8/8/8/4k3/8/8/8/Q3K3 w - - 0 1', side: 1, goal: 'win', tip: 'Use the queen to box the king in a smaller and smaller area (a knight\'s move away), then bring your king to help. Watch for stalemate!' },
    { id: 'kr', name: 'King and rook vs king', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', side: 1, goal: 'win', tip: 'Cut the enemy king off with the rook, march your king up, and push the king to an edge with the opposition, then check on the edge.' },
    { id: 'lucena', name: 'Lucena position (build a bridge)', fen: '1K1k4/1P6/8/8/8/8/r7/5R2 w - - 0 1', side: 1, goal: 'win', tip: 'The pawn is on the 7th, the king is in front of it but hemmed in by the enemy rook. Slide your rook to the 4th rank and use it as a bridge to shield your king.' },
    { id: 'kpk', name: 'King and pawn vs king (win it)', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', side: 1, goal: 'win', tip: 'Your king is already in front of the pawn on a key square. Keep your king in front, use the opposition, and walk the pawn in. Do not stalemate!' },
    { id: 'bb', name: 'Two bishops vs king', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', side: 1, goal: 'win', tip: 'Use both bishops side by side to push the king to the edge, then to a corner, and bring your king to help. The bishops cover diagonals next to each other like a wall.' },
    { id: 'rr', name: 'Two rooks vs king (the ladder)', fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1', side: 1, goal: 'win', tip: 'Check with one rook, then leapfrog the other rook a rank higher, driving the king to the edge one rank at a time.' },  ];
  const openings = [
    { id: 'italian', name: 'Italian Game', c: 1, m: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+', idea: 'Aim the bishop at f7, build a big pawn centre with c3 and d4. Quick, natural and rich in tactics. A great first opening.' },
    { id: 'ruy', name: 'Ruy Lopez', c: 1, m: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O', idea: 'Pressure the knight that guards e5. A slow squeeze that has been played by world champions for 150 years.' },
    { id: 'scotch', name: 'Scotch Game', c: 1, m: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6', idea: 'Open the centre immediately. White gets easy development and a lead in space, Black gets the bishop pair.' },
    { id: 'kg', name: 'King\'s Gambit', c: 1, m: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5', idea: 'Sacrifice a pawn for rapid attack on the f-file. Wild and romantic, and risky: you will learn tactics fast.' },
    { id: 'qg', name: 'Queen\'s Gambit', c: 1, m: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6', idea: 'Challenge Black\'s centre pawn. It is not really a gambit (you can win the pawn back). Solid, strategic, and a favourite of strong players.' },
    { id: 'london', name: 'London System', c: 1, m: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O', idea: 'A simple setup you can play against almost anything. Develop the bishop outside the pawn chain, then build a sturdy centre.' },
    { id: 'english', name: 'English Opening', c: 1, m: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7', idea: 'Control the centre from the side. Flexible: you can transpose into many other systems.' },
    { id: 'najdorf', name: 'Sicilian Defence: Najdorf', c: -1, m: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7', idea: 'The sharpest reply to 1.e4. Black fights for the win from move one with an unbalanced pawn structure.' },
    { id: 'french', name: 'French Defence', c: -1, m: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O', idea: 'Solid and counterattacking: let White build a centre, then attack it with ...c5 and ...f6. Watch out for the "bad" light-squared bishop.' },
    { id: 'caro', name: 'Caro-Kann Defence', c: -1, m: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7', idea: 'Rock-solid: free the light-squared bishop before closing the pawn chain. A good choice if you like safe, healthy positions.' },
    { id: 'scand', name: 'Scandinavian Defence', c: -1, m: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6', idea: 'Strike at the e4 pawn at once. Easy to learn because the structure is clear, but the queen comes out early so play carefully.' },
    { id: 'petroff', name: 'Petroff Defence', c: -1, m: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7', idea: 'Mirror White\'s attack and counter-attack the e4 pawn. Extremely solid; hard for White to get an edge.' },
    { id: 'pirc', name: 'Pirc Defence', c: -1, m: 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6', idea: 'Let White take the centre, then undermine it with pieces from the flank. Flexible and fighting.' },
    { id: 'kid', name: 'King\'s Indian Defence', c: -1, m: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6', idea: 'Allow a big white centre and then attack it. Black usually plays for a kingside pawn storm.' },
    { id: 'nimzo', name: 'Nimzo-Indian Defence', c: -1, m: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6', idea: 'Pin the knight and fight for e4. One of the most respected defences against 1.d4.' },
    { id: 'slav', name: 'Slav Defence', c: -1, m: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4', idea: 'Support d5 with a pawn on c6 and keep the light-squared bishop active. A very reliable answer to the Queen\'s Gambit.' },
    { id: 'qgd', name: 'Queen\'s Gambit Declined', c: -1, m: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6', idea: 'Hold the centre pawn with ...e6. The structure is solid; the plan is to free your game with ...c5 or ...e5.' },
  ];
  return { endgames, openings };
})();
