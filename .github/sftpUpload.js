'use strict';
async function upload(host,user,key,local,remoteDir){
    let remoteFile=local.replace(/.*\//,'');
    let Client=require('ssh2-sftp-client');
    let sftp=new Client();
    var result= await sftp.connect({
        host:host,
        user:user,
        privateKey:key
    }).then(()=>{
        return sftp.exists(remoteDir);
    })
    .then((exists)=>{
        if (! exists) {
            console.log("creating remote dir "+remoteDir);
            return sftp.mkdir(remoteDir,true);
        }
        return true;
    })
    .then(()=>{
        console.log("uploading "+local+" to "+remoteDir);
        return sftp.put(local,remoteDir+"/"+remoteFile);
    })
    .then(()=>sftp.end())
    .then(()=>'')
    .catch((error)=>{sftp.end();return error});
    console.log("upload returns: "+result);
    return result;
}
module.exports=upload;
