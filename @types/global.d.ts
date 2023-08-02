declare class Command {
    command: string;
    desp: string;
}

declare module 'global' {
    export async function post(url: string, params: object): any;
    export async function get(url: string): any;
    export async function sleep(time: number): void;
    export async function random(arr: Array): any;
    export async function sendWechatMessage(contact: any, message: any): void;
}


