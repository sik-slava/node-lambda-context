import { SQSEvent, SQSBatchResponse, SQSRecord } from 'aws-lambda';
import { middleware, build } from './lambda-ctx';
import { ContextLike, EventLike, NextHandler, MiddlewareHandler } from './lambda-ctx';

// export interface SqsRecord extends SQSRecord, EventLike { }
export type SqsRecord = SQSRecord & EventLike;

export default function sqs<TResult = any>(handler: NextHandler<SqsRecord, TResult | void>) {

    const {
        parseBodyAsPayload,
        beGraceful,
        runWithinNs,
        setStorage
    } = middleware<SqsRecord, SQSBatchResponse | void>();

    const processSqsRecords: MiddlewareHandler = (next: NextHandler) => {
        return function (evt: SQSEvent, ctx: ContextLike) {
            return Promise.all(evt.Records.map(rec => next(rec, ctx)))
        }
    }

    return build(
        runWithinNs,
        setStorage,
        processSqsRecords,
        runWithinNs,
        parseBodyAsPayload,
        beGraceful
    )(handler)
}