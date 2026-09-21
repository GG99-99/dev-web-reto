import './NotificationsDropdown.css';
interface NotificationsDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdateUnreadCount?: (count: number) => void;
    notify: (msg: string) => void;
}
export default function NotificationsDropdown({ isOpen, onClose, onUpdateUnreadCount, notify, }: NotificationsDropdownProps): import("react").JSX.Element | null;
export {};
