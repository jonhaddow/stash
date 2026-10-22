import { createContext } from 'svelte';

/**
 * Changes the unread count on the Feeds tab and the app icon straight away (by -1
 * for an entry read here), before the layout's next load says so.
 */
export const [getUnreadChange, setUnreadChange] = createContext<(by: number) => void>();
