import { log } from "./logger";
import * as FridaHookSwiftAlamofire from "./FridaHookSwiftAlamofire/index";
import * as app from "./app/index";
//import { ls, lsAppBundle, lsAppData,appBundlePath,appDataPath, plist, text, download } from './app/finder'


FridaHookSwiftAlamofire.attachHookNet();

app.run();

