import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Encode army numbers that contain spaces (e.g. "P 13453"). */
export function studentPath(armyNumber: string, suffix = "") {
  return `/students/${encodeURIComponent(armyNumber)}${suffix}`
}

export function decodeArmyNumber(param: string) {
  try {
    return decodeURIComponent(param)
  } catch {
    return param
  }
}
