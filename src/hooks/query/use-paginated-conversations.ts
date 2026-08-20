import { useInfiniteQuery } from "@tanstack/react-query";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { useIsAuthed } from "./use-is-authed";
import { isNoBackend } from "#/api/backend-registry/active-store";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { useNavigation } from "#/context/navigation-context";
import { AppConversationPage } from "#/api/conversation-service/agent-server-conversation-service.types";
import { isAutomationsRoute } from "#/manifests/automation-interface";

const CONVERSATION_LIST_POLL_INTERVAL_MS = 10_000;

export const usePaginatedConversations = (limit: number = 20) => {
  const { data: userIsAuthenticated } = useIsAuthed();
  const active = useActiveBackend();
  const hasBackend = !isNoBackend(active.backend);
  const { currentPath } = useNavigation();
  const pollConversationList = !isAutomationsRoute(currentPath);

  return useInfiniteQuery({
    // Include the active backend identity so each (backend, org) pair
    // maintains its own paginated cache. Switching backends naturally
    // produces a new query and a fresh fetch — without it the previous
    // backend's conversations stay visible for staleTime.
    queryKey: [
      "user",
      "conversations",
      "paginated",
      limit,
      active.backend.id,
      active.orgId,
    ],
    queryFn: async ({ pageParam }) => {
      const result = await AgentServerConversationService.searchConversations(
        limit,
        pageParam,
      );

      return result;
    },
    enabled: !!userIsAuthenticated && hasBackend,
    getNextPageParam: (lastPage: AppConversationPage) => lastPage.next_page_id,
    initialPageParam: undefined as string | undefined,
    // Poll every 10s so titles, execution status, and timestamps stay fresh
    // without requiring the user to refresh. Consumers must gate initial-load
    // UI (e.g. skeletons) on `isLoading`, not `isFetching` — `isFetching`
    // flips back to true on every background refetch, which would cause the
    // skeleton to flicker every 10s when the list is empty.
    refetchInterval: pollConversationList
      ? CONVERSATION_LIST_POLL_INTERVAL_MS
      : false,
    refetchIntervalInBackground: false,
    // A successful fetch proves the backend is reachable. The global
    // QueryCache onSuccess handler reads this to clear any persisted
    // failure state, re-arming the status dot without user intervention.
    meta: { backendId: active.backend.id },
  });
};
