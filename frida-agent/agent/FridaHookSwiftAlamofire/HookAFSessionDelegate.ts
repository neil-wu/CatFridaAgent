import { log } from "./logger";
import { SDSwiftDataStorage } from "./SDSwiftDataStorage";
import * as SDNetDump from "./SDNetDump";
import * as SwiftRuntime from "./SwiftRuntime";
import * as fridamsg from "../fridamsg";
import * as Util from "./Util"
import { once } from "process";
import { tmpdir } from "os";
import { toNamespacedPath } from "path";

function enterFuncUrlSessionDidReceive(this: InvocationContext, args: InvocationArguments) {
    // String is parsed by value
    let ptr1 = args[0]; //NSURLSession
    let ptr2 = args[1]; //NSURLSessionDataTask
    let rangePtr = args[2];
    let dataStoragePtr = args[3]; // Foundation.__DataStorage <-> Swift.Data
    

    const session = new ObjC.Object(ptr1); //NSURLSession
    const sessionDataTask = new ObjC.Object(ptr2); //NSURLSessionDataTask
    parseNSURLSessionDataTask(sessionDataTask, dataStoragePtr, false)
} 

function parseNSURLSessionDataTask(sessionDataTask: ObjC.Object, dataStoragePtr: NativePointer, isNSData: Boolean) {

    const request = sessionDataTask.currentRequest(); //NSURLRequest
    const dataLen = sessionDataTask.response().expectedContentLength()
    log(`1112-> ${request} > ${request.URL().absoluteString()}`)

    const reqStr:string = SDNetDump.dumpRequest(request);
    let output:string = reqStr;
    

    //log(`rangePtr = ${ rangePtr }, dataStoragePtr=${dataStoragePtr}`);
    log(`dataLen=${dataLen}`);

    
    let urlstr = request.URL().absoluteString().toString();
    let method = request.HTTPMethod().toString(); // NSString
    
    var sdataStr: string = ""
    if (isNSData) {
        const nsdata = new ObjC.Object(dataStoragePtr)
        sdataStr = nsdata.bytes().readUtf8String(nsdata.length());
        
    } else {
        //swift data
        let sdata = new SDSwiftDataStorage(dataStoragePtr);
        log(`   ${ sdata.bytesPtr.readCString() }`);
        
        sdataStr = sdata.bytesPtr.readCString(dataLen) ?? ""; // parse the response data, default as string

        output += "\n";
        output += SDNetDump.intent + `>>> ${sdataStr}`;
        //console.log("delegate", `${output}`)

    }
    fridamsg.sendMsgNetwork(urlstr, method, reqStr, sdataStr);

    //----
    // you can also use the following function to print Data.
    //SwiftRuntime.swiftDataBridgeToObjectiveCByPtr(rangePtr, dataStoragePtr);
    
}

function enterFuncUrlSessionDidReceive2(this: InvocationContext, args: InvocationArguments) {
    // OC function
    // [self, SEL, URLSession,dataTask,didReceiveData:]
    //let ptr1 = args[0]; //self
    //let ptr2 = args[1]; //method
    let ptr1 = args[2]; //NSURLSession
    let ptr2 = args[3]; //NSURLSessionDataTask
    const session = new ObjC.Object(ptr1); //NSURLSession
    const sessionDataTask = new ObjC.Object(ptr2); //NSURLSessionDataTask
    let dataStoragePtr = args[4]; // NSData
    parseNSURLSessionDataTask(sessionDataTask, dataStoragePtr, true)

}
function attach() {
   /* try {
        //Alamofire.SessionDelegate.urlSession(_: __C.NSURLSession, dataTask: __C.NSURLSessionDataTask, didReceive: Foundation.Data) -> ()
        const func_urlSessionDidReceive = Module.getExportByName(null, '$s9Alamofire15SessionDelegateC03urlB0_8dataTask10didReceiveySo12NSURLSessionC_So0i4DataF0C10Foundation0J0VtF');
        log(`[HookAFSessionDelegate] func_urlSession ${func_urlSessionDidReceive}`);
        Interceptor.attach(func_urlSessionDidReceive, { onEnter: enterFuncUrlSessionDidReceive});
    } catch (e) {
        log(`[HookAFSessionDelegate] fail to hook Alamofire.SessionDelegate !, ${e}`);
    }*/
    try {
        // -[Alamofire.SessionDelegate URLSession:dataTask:didReceiveData]
        const afdelegate = ObjC.classes['_TtC9Alamofire15SessionDelegate']
        const hookAF = afdelegate['- URLSession:dataTask:didReceiveData:']
        log(`hook OC Alamofire.SessionDelegate=${afdelegate} ${hookAF.implementation}`);
        Interceptor.attach(hookAF.implementation, {
            onEnter : enterFuncUrlSessionDidReceive2,
        });
    } catch (e) {
        log(`[HookAFSessionDelegate] fail to hook OC Alamofire.SessionDelegate !, ${e}`);
    }
}

export {
    attach,
}

