import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind sınıflarını birleştirir ve çakışan sınıfları akıllıca çözer.
 * clsx: koşullu sınıf birleştirme; twMerge: Tailwind çakışma çözümü.
 * Örn: cn("p-4", isActive && "bg-indigo-600", "p-2") → "bg-indigo-600 p-2"
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Uygulamanın bir iframe içinde çalışıp çalışmadığını belirler */
export const isIframe = window.self !== window.top;
