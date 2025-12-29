import type { Handler } from 'aws-lambda';

// Placeholder EventBridge handler.
// This keeps the function deployable while you migrate the Nest FSM modules.
export const handler: Handler = async (event, context) => {
    console.log('fsm-event-handler received event:', JSON.stringify(event));
    return { ok: true };
};
