const net=require('net'),crypto=require('crypto');
function broker(port){
  const subs=new Map();
  const srv=net.createServer(sock=>{
    let hs=false,buf=Buffer.alloc(0),mq=Buffer.alloc(0);
    const wsend=b=>{const h=b.length<126?Buffer.from([0x82,b.length]):Buffer.from([0x82,126,b.length>>8,b.length&255]);sock.write(Buffer.concat([h,b]))};
    sock.on('data',d=>{
      buf=Buffer.concat([buf,d]);
      if(!hs){const s=buf.toString();if(!s.includes('\r\n\r\n'))return;
        const k=/Sec-WebSocket-Key: (.*)\r\n/i.exec(s)[1].trim();
        sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Protocol: mqtt\r\nSec-WebSocket-Accept: '+crypto.createHash('sha1').update(k+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')+'\r\n\r\n');
        hs=true;buf=Buffer.alloc(0);return}
      for(;;){
        if(buf.length<2)return;let len=buf[1]&127,o=2;
        if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);o=4}
        if(buf.length<o+4+len)return;
        const mask=buf.slice(o,o+4),p=Buffer.from(buf.slice(o+4,o+4+len));for(let i=0;i<p.length;i++)p[i]^=mask[i%4];
        buf=buf.slice(o+4+len);mq=Buffer.concat([mq,p]);
        for(;;){
          if(mq.length<2)break;let i=1,m=1,rl=0,b;
          do{if(i>=mq.length)break;b=mq[i++];rl+=(b&127)*m;m*=128}while(b&128);
          if(mq.length<i+rl)break;
          const h=mq[0],body=mq.slice(i,i+rl),full=mq.slice(0,i+rl);mq=mq.slice(i+rl);const ty=h>>4;
          if(ty===1)wsend(Buffer.from([0x20,2,0,0]));
          else if(ty===8){const tl=body.readUInt16BE(2),t=body.slice(4,4+tl).toString();if(!subs.has(t))subs.set(t,new Set());subs.get(t).add(wsend);wsend(Buffer.from([0x90,3,body[0],body[1],0]))}
          else if(ty===3){const tl=body.readUInt16BE(0),t=body.slice(2,2+tl).toString();(subs.get(t)||[]).forEach(f=>f(full))}
          else if(ty===12)wsend(Buffer.from([0xD0,0]));
        }
      }
    });
    sock.on('error',()=>{});
  });
  return new Promise(r=>srv.listen(port,'127.0.0.1',()=>r(srv)));
}

module.exports={broker};
