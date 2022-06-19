import * as cls from 'cls-hooked';
import { Context } from 'aws-lambda';

const defaultNamespace = cls.createNamespace('unique-lambda-context');

function getStorage(namespace: cls.Namespace) {
    return {
        get<TValue = any>(key: string): TValue | undefined {
            if (namespace && namespace.active)
                return namespace.get(key);
        },
        set<TValue = any>(key: string, value: TValue) {
            if (namespace && namespace.active) {
                return namespace.set(key, value)
            }
        }
    }
}

type Storage = ReturnType<typeof getStorage>;

type JsonLike = string;

export interface ContextLike extends Context {
    storage: Storage,
}
export interface EventLike<TPayload extends {} = any> {
    body?: JsonLike,
    payload: TPayload,
    error?: Error,
}

export type Handler<TEvent extends EventLike = any, TResult = any> = (evt: TEvent, ctx: ContextLike) => void | Promise<TResult>;
export type NextHandler<TEvent extends EventLike = any, TResult = any> = Handler<TEvent, TResult>;
export type MiddlewareHandler<TEvent extends EventLike = any, TResult = any> = (next: NextHandler<TEvent, TResult>) => NextHandler<TEvent, TResult>;

export function middleware<TEvent extends EventLike, TResult = any>() {

    const create = (handler: NextHandler): MiddlewareHandler => (next: NextHandler) => {
        return async function (evt: TEvent, ctx: ContextLike) {
            await handler(evt, ctx);
            return next(evt, ctx);
        }
    }

    const runWithinNs = (next: NextHandler) => {
        return function (evt: TEvent, ctx: ContextLike) {
            return defaultNamespace.runAndReturn(() => next(evt, ctx))
        }
    }

    const setStorage: MiddlewareHandler = (next: NextHandler) => {
        return function (evt: TEvent, ctx: ContextLike) {
            ctx.storage = getStorage(defaultNamespace);
            return next(evt, ctx);
        }
    }

    const parseBodyAsPayload: MiddlewareHandler = (next: NextHandler) => {
        return function (evt: TEvent, ctx: ContextLike) {
            return next({ ...evt, payload: JSON.parse(evt.body!) }, ctx);
        }
    }

    const beGraceful = (next: NextHandler) => {
        return async function (evt: TEvent, ctx: ContextLike) {
            const awaitable = async () => next(evt, ctx);

            return awaitable()
                .catch(e => evt.error = e)
        }
    }

    return {
        create,
        runWithinNs,
        setStorage,
        parseBodyAsPayload,
        beGraceful
    }
}

export function build(...items: MiddlewareHandler[]): MiddlewareHandler {
    return function (next: NextHandler) {
        return items.reverse().reduce((acc, curr) => curr(acc), next);
    }
}
