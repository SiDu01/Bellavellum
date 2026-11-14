/// <reference types="vite/client" />
import type { BellavellumApi } from '../../preload/index'

declare global {
  interface Window {
    bellavellum: BellavellumApi
  }
}
