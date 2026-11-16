const {chromium}=require('playwright');
const https=require('https'),fs=require('fs'),path=require('path');
const {broker}=require('./broker.js');
const H=require('./harness.js');
let fails=0;const ok=(c,m)=>{console.log((c?'  OK    ':'  FALHA ')+m);if(!c)fails++};
const FAKE_YT=`window.YT={PlayerState:{ENDED:0,PLAYING:1,PAUSED:2},Player:function(el,o){const me=this;let base=(o.playerVars&&o.playerVars.start)||0,st=-1,last=Date.now(),vol=100;
 const cur=()=>base+(st===1?(Date.now()-last)/1000:0);me.__log=[];me.__opts=o;window.__yt=me;el.textContent='YT '+o.videoId;
 setTimeout(()=>{o.events.onReady({});if(o.playerVars.autoplay){base=cur();last=Date.now();st=1}},40);
 me.playVideo=()=>{base=cur();last=Date.now();st=1;me.__log.push('play')};me.pauseVideo=()=>{base=cur();last=Date.now();st=2;me.__log.push('pause')};
 me.seekTo=s=>{base=s;last=Date.now();me.__log.push('seek:'+Math.round(s))};me.getCurrentTime=cur;me.getDuration=()=>600;
 me.setVolume=v=>{vol=v;me.__vol=v};me.mute=()=>{me.__muted=true};me.unMute=()=>{me.__muted=false};me.destroy=()=>{me.__destroyed=true};me.__state=()=>st;}};`;
const FAKE_TW=`window.Twitch={Player:function(el,o){const me=this,ev={};me.__opts=o;me.__log=[];window.__tw=me;let t=0,playing=!!o.autoplay,last=Date.now();
 const cur=()=>t+(playing?(Date.now()-last)/1000:0);
 me.addEventListener=(e,f)=>{ev[e]=f;if(e==='ready')setTimeout(f,40)};me.play=()=>{t=cur();last=Date.now();playing=true;me.__log.push('play')};me.pause=()=>{t=cur();last=Date.now();playing=false;me.__log.push('pause')};
 me.seek=s=>{t=s;last=Date.now();me.__log.push('seek:'+Math.round(s))};me.getCurrentTime=cur;me.getDuration=()=>3600;me.setVolume=v=>{me.__vol=v};me.setMuted=m=>{me.__muted=m};}};
 window.Twitch.Player.READY='ready';window.Twitch.Player.PLAYING='playing';window.Twitch.Player.PAUSE='pause';window.Twitch.Player.ENDED='ended';`;
(async()=>{
  const b1=await broker(18861),b2=await broker(18862);
  const web=await H.servir(H.paginaDeTeste(['ws://127.0.0.1:18861','ws://127.0.0.1:18862']),18863);
  const wav=H.wavDeTeste();
  const cert=H.certDeTeste();
  const med=cert&&https.createServer({key:cert.key,cert:cert.cert},(q,r)=>{
    const m=/bytes=(\d+)-(\d*)/.exec(q.headers.range||'');
    if(m){const a=+m[1],z=m[2]?+m[2]:wav.length-1;r.writeHead(206,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Range':`bytes ${a}-${z}/${wav.length}`,'Content-Length':z-a+1});r.end(wav.slice(a,z+1))}
    else{r.writeHead(200,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':wav.length});r.end(wav)}});
  if(med)await new Promise(r=>med.listen(18864,'127.0.0.1',r));
  const br=await chromium.launch({args:H.ARGS});
  const errs=[];
  const mk=async n=>{const c=await br.newContext({ignoreHTTPSErrors:true,permissions:['microphone','camera'],viewport:{width:1280,height:720}});
    await c.route('https://www.youtube.com/iframe_api',r=>r.fulfill({contentType:'text/javascript',body:FAKE_YT}));
    await c.route('https://player.twitch.tv/js/embed/v1.js',r=>r.fulfill({contentType:'text/javascript',body:FAKE_TW}));
    await c.route(/open\.spotify\.com|tiktok\.com|clips\.twitch\.tv/,r=>r.abort());
    const p=await c.newPage();p.on('pageerror',e=>errs.push(n+': '+e.message));
    await p.goto('http://127.0.0.1:18863/');await p.fill('#nome',n);await p.fill('#cod','sala-midia-teste-01');await p.click('#go');await p.waitForSelector('#room',{state:'visible',timeout:15000});return p};
  const enter=async p=>{await p.click("#vv");await p.click("#bj");await p.waitForSelector('[role=dialog][aria-label^="Escolha"]');await p.click('[role=dialog][aria-label^="Escolha"] .btn.pri');await p.waitForTimeout(900)};
  const play=async(p,link)=>{await p.click('#bmd');await p.fill('#mlk',link);await p.click('#mok')};
  const btn=(p,i)=>p.locator('.mbar button').nth(i);   // 0=play/pause 1=stop 2=mudo 3=sync
  const A=await mk('Ana'),B=await mk('Bia');await A.waitForTimeout(800);await enter(A);await enter(B);await A.waitForTimeout(2000);

  console.log('Reconhecimento de links');
  const tab=await A.evaluate(()=>{const L=['https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10','https://youtube.com/shorts/dQw4w9WgXcQ','https://music.youtube.com/watch?v=dQw4w9WgXcQ','https://www.twitch.tv/gaules','https://www.twitch.tv/videos/123456789','https://www.twitch.tv/gaules/clip/AbCdE-fGhIj','https://clips.twitch.tv/AbCdEfGhIj','https://open.spotify.com/intl-pt/track/4uLU6hMCjMI75M1A2tKUQC','https://www.tiktok.com/@alguem/video/7234567890123456789','https://exemplo.com/musica.mp3','https://exemplo.com/v/filme.webm',
      'javascript:alert(1)','http://exemplo.com/a.mp3','https://exemplo.com/pagina','https://youtube.com/watch?v=curto','https://user:senha@exemplo.com/a.mp3','https://www.twitch.tv/videos','data:text/html,x','ftp://x.com/a.mp3','vm.tiktok.com/ZMabc','https://vm.tiktok.com/ZMabc/'];
    return L.map(u=>{const r=parseMedia(u);return r.spec?r.spec.k+(r.spec.t?':'+r.spec.t:''):'ERRO'})});
  const esperado=['yt','yt','yt','yt','twch','twv','twc','twc','sp:track','tt','url','url','ERRO','ERRO','ERRO','ERRO','ERRO','ERRO','ERRO','ERRO','ERRO','ERRO'];
  ok(JSON.stringify(tab)===JSON.stringify(esperado),'12 links válidos reconhecidos e 10 inválidos recusados'+(JSON.stringify(tab)===JSON.stringify(esperado)?'':' -> '+JSON.stringify(tab)));

  console.log('YouTube sincronizado');
  await play(A,'https://youtu.be/dQw4w9WgXcQ');await A.waitForTimeout(2500);
  const yt=p=>p.evaluate(()=>({tile:!!tiles.media,id:window.__yt&&window.__yt.__opts.videoId,st:window.__yt&&window.__yt.__state(),lid:mState&&mState.lid,log:window.__yt?window.__yt.__log.slice():[],vol:window.__yt&&window.__yt.__vol,foco:!!(tiles.media&&tiles.media.d.classList.contains('focus'))}));
  let a=await yt(A),b=await yt(B);
  ok(a.tile&&b.tile&&a.id==='dQw4w9WgXcQ'&&b.id==='dQw4w9WgXcQ'&&a.lid===b.lid,'os dois recebem o mesmo vídeo (mesma sessão)');
  ok(a.st===1&&b.st===1,'os dois começam tocando');
  ok(a.foco&&b.foco,'o player ganha o destaque na tela');
  ok((await B.evaluate(()=>[...document.querySelectorAll('#log .sys .m')].map(x=>x.textContent).join('|'))).includes('Ana colocou um vídeo do YouTube'),'aviso no chat de quem colocou');
  await btn(A,0).click();await A.waitForTimeout(1200);b=await yt(B);
  ok(b.log.includes('pause')&&b.st===2,'Ana pausa -> pausa na Bia');
  await btn(B,0).click();await A.waitForTimeout(1200);a=await yt(A);
  ok(a.log.includes('play')&&a.st===1,'Bia dá play -> toca na Ana');
  await B.evaluate(()=>{const r=tiles.media.seek;r.max=600;r.value=120;r.dispatchEvent(new Event('change'))});await A.waitForTimeout(1200);a=await yt(A);
  ok(a.log.includes('seek:120'),'Bia muda a posição para 2:00 -> Ana vai para 2:00');
  const volB0=(await yt(B)).vol;
  await A.evaluate(()=>{const v=tiles.media.vol;v.value=20;v.dispatchEvent(new Event('input'))});await A.waitForTimeout(500);
  ok((await yt(A)).vol===20&&(await yt(B)).vol===volB0,'volume é só de quem mexeu (Ana 20, Bia continua em '+volB0+')');
  await A.evaluate(()=>{tiles.media.mu.click()});await A.waitForTimeout(300);
  ok(await A.evaluate(()=>window.__yt.__muted===true),'botão de silenciar vale só para quem clicou');ok(await B.evaluate(()=>!window.__yt.__muted),'e não silencia o outro');
  await A.evaluate(()=>{tiles.media.mu.click()});

  console.log('Quem entra depois');
  const C=await mk('Caio');await enter(C);await C.waitForTimeout(6000);
  const c=await yt(C);
  ok(c.tile&&c.id==='dQw4w9WgXcQ'&&c.lid===a.lid,'Caio entra na call e recebe o vídeo em andamento');
  const posC=await C.evaluate(()=>window.__yt?window.__yt.getCurrentTime():-999),posA=await A.evaluate(()=>window.__yt.getCurrentTime());
  ok(Math.abs(posC-posA)<6,'na mesma posição aproximada (Caio '+Math.round(posC)+'s, Ana '+Math.round(posA)+'s)');
  await btn(B,1).click();await A.waitForTimeout(1500);
  ok(!(await yt(A)).tile&&!(await yt(C)).tile&&await A.evaluate(()=>window.__yt.__destroyed===true),'stop de qualquer um fecha o player para todos');
  await C.close();

  if(!med)console.log('Arquivo de áudio direto\n  (pulado: o openssl não foi encontrado para gerar o certificado de teste)');
  else{
  console.log('Arquivo de áudio direto');
  await play(B,'https://127.0.0.1:18864/tone.wav');await B.waitForTimeout(3000);
  const au=p=>p.evaluate(()=>{const e=tiles.media&&tiles.media.view.querySelector('audio');return e?{t:e.currentTime,paused:e.paused,vol:e.volume}:null});
  let x=await au(A),y=await au(B);
  ok(x&&y&&x.t>1&&y.t>1&&!x.paused&&!y.paused,'toca nos dois (Ana '+(x&&x.t.toFixed(1))+'s, Bia '+(y&&y.t.toFixed(1))+'s)');
  await btn(A,0).click();await A.waitForTimeout(1200);y=await au(B);ok(y.paused,'pause de um pausa o outro');
  await A.evaluate(()=>{const r=tiles.media.seek;r.max=90;r.value=30;r.dispatchEvent(new Event('change'))});await B.waitForTimeout(1500);y=await au(B);
  ok(y.t>=28&&y.t<=33,'posição 0:30 chega ao outro ('+y.t.toFixed(1)+'s)');
  await B.evaluate(()=>{const v=tiles.media.vol;v.value=35;v.dispatchEvent(new Event('input'))});await B.waitForTimeout(300);
  ok((await au(B)).vol===0.35&&(await au(A)).vol!==0.35,'volume do arquivo também é individual');
  await btn(A,1).click();await B.waitForTimeout(1000);ok(!(await au(B)),'stop remove o player');

  }
  console.log('Spotify, TikTok e Twitch');
  await play(A,'https://open.spotify.com/intl-pt/track/4uLU6hMCjMI75M1A2tKUQC?si=abc');await B.waitForTimeout(1500);
  const sp=await B.evaluate(()=>{const f=tiles.media.view.querySelector('iframe');return {src:f&&f.src,pp:tiles.media.pp.disabled,seek:tiles.media.seek.disabled,st:tiles.media.st.disabled}});
  ok(sp.src==='https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'&&sp.pp&&sp.seek&&!sp.st,'Spotify: embed correto, play/posição desativados (sem sincronia), stop ativo');
  await btn(B,1).click();await A.waitForTimeout(1000);
  await play(B,'https://www.tiktok.com/@alguem/video/7234567890123456789');await A.waitForTimeout(1500);
  ok(await A.evaluate(()=>{const f=tiles.media.view.querySelector('iframe');return f&&f.src.startsWith('https://www.tiktok.com/player/v1/7234567890123456789')}),'TikTok: embed correto');
  await btn(A,1).click();await B.waitForTimeout(1000);
  await play(A,'https://www.twitch.tv/videos/123456789');await B.waitForTimeout(2500);
  const tw=await B.evaluate(()=>({v:window.__tw.__opts.video,par:window.__tw.__opts.parent.join(),ctl:window.__tw.__opts.controls,seek:tiles.media.seek.disabled}));
  ok(tw.v==='v123456789'&&tw.par==='127.0.0.1'&&tw.ctl===false&&!tw.seek,'Twitch (vídeo): opções corretas, posição liberada');
  await btn(A,0).click();await B.waitForTimeout(1000);ok(await B.evaluate(()=>window.__tw.__log.includes('pause')),'Twitch: pause chega ao outro');
  await btn(B,1).click();await A.waitForTimeout(800);
  await play(B,'https://www.twitch.tv/gaules');await A.waitForTimeout(2500);
  ok(await A.evaluate(()=>window.__tw.__opts.channel==='gaules'&&tiles.media.seek.disabled),'Twitch (live): canal correto e posição desativada');
  await btn(A,1).click();await B.waitForTimeout(800);

  console.log('Proteção contra mensagens maliciosas');
  await A.evaluate(()=>{R.emit('media',{op:'load',lid:'zz1',spec:{k:'url',ref:'http://evil.example/a.mp3'}});R.emit('media',{op:'load',lid:'zz2',spec:{k:'yt',ref:'../../x'}});R.emit('media',{op:'load',lid:'zz3',spec:{k:'sp',t:'track;x',ref:'4uLU6hMCjMI75M1A2tKUQC'}});R.emit('media',{op:'load',lid:'zz4',spec:{k:'url',ref:'https://u:p@evil.example/a.mp3'}})});
  await B.waitForTimeout(1500);ok(await B.evaluate(()=>!mState&&!tiles.media),'ligações com endereço inseguro ou inválido são ignoradas');
  ok(errs.length===0,'nenhum erro de JavaScript'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await br.close();web.close();if(med)med.close();b1.close();b2.close();
  console.log(fails?'\n'+fails+' falha(s)':'\nTudo certo');process.exit(fails?1:0);
})().catch(e=>{console.log('ERRO',e.message);process.exit(1)});
