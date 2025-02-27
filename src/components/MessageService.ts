export type MessageListener = (message: string) => void;

export class MessageService {
    private static instance: MessageService;
    private listeners: Map<string, MessageListener[]> = new Map();

    private constructor() { } // Private constructor for singleton

    // Get the singleton instance
    public static getInstance(): MessageService {
        if (!MessageService.instance) {
            MessageService.instance = new MessageService();
        }
        return MessageService.instance;
    }

    // Subscribe to messages with a specific channel/topic
    public subscribe(channel: string, listener: MessageListener): () => void {
        if (!this.listeners.has(channel)) {
            this.listeners.set(channel, []);
        }

        this.listeners.get(channel)!.push(listener);

        // Return an unsubscribe function
        return () => {
            const channelListeners = this.listeners.get(channel);
            if (channelListeners) {
                const index = channelListeners.indexOf(listener);
                if (index !== -1) {
                    channelListeners.splice(index, 1);
                }
            }
        };
    }

    // Publish a message to a specific channel/topic
    public publish(channel: string, message: string): void {
        const channelListeners = this.listeners.get(channel);
        if (channelListeners) {
            channelListeners.forEach(listener => listener(message));
        }
    }
}