(() => {
  const regions=[
    {name:'Copperfall',color:'#e2ae68',material:'resin',boss:'Glasswing',token:'glass_chime',loot:['prism','silk']},
    {name:'Lantern Fen',color:'#73d7aa',material:'reedpearl',boss:'Lantern Darner',token:'reed_whistle',loot:['jade_wing','bog_opal']},
    {name:'Saffron Reach',color:'#e9a259',material:'sunshard',boss:'Dunebreaker',token:'sun_scarab',loot:['amber_shell','sun_lens']},
    {name:'Rimewatch',color:'#99dafa',material:'frostbloom',boss:'Rime Oracle',token:'frost_chime',loot:['rime_plume','aurora_ice']},
    {name:'Astral Moor',color:'#cba8ff',material:'starglass',boss:'Veil Medusa',token:'void_pearl',loot:['nebula_silk','void_core']}
  ];
  const quarry={name:'Copperfall',material:'copper',boss:'Quarry King',token:'quarry_drum',loot:['quarry_heart','bronze_horn']};
  const relics={
    quarry_drum:['Deepcut chisel','25% faster mining'],
    glass_chime:['Prism hilt','longer melee reach'],
    reed_whistle:['Fen runners','20% faster running'],
    sun_scarab:['Amber signet','one extra melee damage'],
    frost_chime:['Aurora clasp','faster dash recovery'],
    void_pearl:['Astral lens','shorter weapon ability cooldowns']
  };
  const weapons=[
    {id:'reedbow',name:'Reed bow',move:'Fan of three arrows',cost:{wood:3,fiber:3},cool:.8,color:'#b3e280'},
    {id:'chakram',name:'Amber chakram',move:'Returning disc',cost:{sunshard:3,copper:2},cool:1.2,color:'#ffd57c'},
    {id:'rimestaff',name:'Rime staff',move:'Frost bolt that slows its target',cost:{frostbloom:3,reedpearl:2,crystal:2},cool:1.3,color:'#a6e8ff'},
    {id:'starbell',name:'Starbell',move:'Nova around the wielder',cost:{starglass:3,nebula_silk:1,void_core:1},cool:2.2,color:'#dfb7ff'}
  ];
  const difficulty={Explorer:{hearts:8,power:.7,hurt:1},Adventurer:{hearts:5,power:1,hurt:1},Veteran:{hearts:4,power:1.45,hurt:2}};
  function write(key,value){
    const encoded=JSON.stringify(value);
    ls.set('worlds_v1_'+key,encoded);
    return ls.get('worlds_v1_'+key,'')===encoded;
  }
  function encode(map){
    const palette=[null],ids=new Map([[null,0]]);
    const columns=map.map(col=>{
      let result='';
      for(const tile of col){
        if(!ids.has(tile)){ids.set(tile,palette.length);palette.push(tile);}
        result+=String.fromCharCode(65+ids.get(tile));
      }
      return result;
    });
    return {palette,columns};
  }
  const decode=data=>data?.columns.map(col=>Array.from(col,ch=>data.palette[ch.charCodeAt(0)-65]));
  const pretty=id=>id.replaceAll('_',' ');
  A.emberExpedition={regions,quarry,relics,weapons,difficulty,write,encode,decode,pretty};
})();
