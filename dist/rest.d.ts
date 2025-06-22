import * as http from 'http';
import { IScorpionAppInternal } from "./types.js";
export declare function startRestServer(app: IScorpionAppInternal<any>, port: number, host: string): Promise<http.Server | undefined>;
