"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Id } from "../../../convex/_generated/dataModel";

type WorkspaceContextType = {
  activeWorkspaceId: Id<"workspaces"> | null;
  setActiveWorkspaceId: (id: Id<"workspaces">) => void;
  workspaces: any[];
  isLoading: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const userId = user?.id;

  const workspaces = useQuery(api.workspaces.getWorkspaces, userId ? { userId } : "skip") || [];
  const createWorkspace = useMutation(api.workspaces.createWorkspace);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<Id<"workspaces"> | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    // Auto-create default workspace if none exists
    const initializeWorkspaces = async () => {
      if (workspaces && workspaces.length === 0 && !hasInitialized) {
        setHasInitialized(true); // Prevent multi-calls
        try {
          const newId = await createWorkspace({
            userId,
            name: `${user?.fullName || "User"}'s Workspace`,
          });
          setActiveWorkspaceId(newId);
        } catch (error) {
          console.error("Failed to create default workspace:", error);
        }
      } else if (workspaces && workspaces.length > 0 && !activeWorkspaceId) {
        // Set the first one as active by default if none is selected
        const firstWorkspace = workspaces[0];
        if (firstWorkspace && firstWorkspace._id) {
            setActiveWorkspaceId(firstWorkspace._id as Id<"workspaces">);
        }
      }
    };

    void initializeWorkspaces();
  }, [userId, workspaces, activeWorkspaceId, createWorkspace, hasInitialized, user?.fullName]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspaceId,
        setActiveWorkspaceId,
        workspaces,
        isLoading: workspaces === undefined,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
