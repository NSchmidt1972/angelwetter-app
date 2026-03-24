import { createContext, useContext } from 'react';

export const SuperAdminHeaderTitleContext = createContext(() => {});

export function useSuperAdminHeaderTitle() {
  return useContext(SuperAdminHeaderTitleContext);
}
