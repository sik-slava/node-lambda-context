# node-lambda-context
Ambient lambda context using middleware approach (WIP)

## Sqs handler

Innermost handler function can assume that event contains parser payload from body. 

```typescript
import sqs from 'lambda-ctx.sqs';

const handle = (event: SqsRecord) => console.log(event.payload);
const handler = sqs(handle);  

export default handler;
```
