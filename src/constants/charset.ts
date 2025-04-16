// FILE: src/constants/charset.ts

// (Moved from app/tool/password-generator/_components/PasswordGeneratorClient.tsx)
export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
export const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const NUMBERS = '0123456789';
export const SYMBOLS = '!@#$%^&*()_+~=`|}{[]:;?><,./-=';

// Combine them for easier access if needed elsewhere, or keep separate
export const ALL_CHARS = {
    LOWERCASE,
    UPPERCASE,
    NUMBERS,
    SYMBOLS,
};