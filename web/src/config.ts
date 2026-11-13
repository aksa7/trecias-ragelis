// Who this line protects. Override per demo in web/.env.local:
//   VITE_PROTECTED_NAME="Aldona, 78"
//   VITE_EMERGENCY_CONTACT="Daughter · +370 6•• •• 088"
export const PROTECTED_NAME: string = import.meta.env.VITE_PROTECTED_NAME ?? 'Aldona, 78';
export const EMERGENCY_CONTACT: string = import.meta.env.VITE_EMERGENCY_CONTACT ?? 'Daughter · +370 6•• •• 088';
