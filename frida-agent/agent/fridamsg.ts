/*
export enum HttpMethodEnum {
    GET = "GET",
    POST = "POST",
}*/

function sendMsgNetwork(url:string, method:string, req:string, rsp:string) { 
    const network = {url, req, rsp};
    const data = {subject: "network", network}
    send(data);
}


export {
    sendMsgNetwork,
}

