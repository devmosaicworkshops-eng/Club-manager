/**
 * Hand-written hooks for endpoints not covered by the code-generated api.ts.
 * Uses the same customFetch/queryClient pattern as the generated hooks.
 */
import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Coach PATCH/DELETE ───────────────────────────────────────────────────────

export interface CoachUpdate {
  nom?: string;
  password?: string;
}

export const getUpdateCoachMutationKey = () => ["updateCoach"] as const;

export function useUpdateCoach(
  options?: UseMutationOptions<void, Error, { username: string; data: CoachUpdate }>
) {
  return useMutation({
    mutationKey: getUpdateCoachMutationKey(),
    mutationFn: async ({ username, data }) => {
      await customFetch<void>(`/api/coaches/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    ...options,
  });
}

export const getDeleteCoachMutationKey = () => ["deleteCoach"] as const;

export function useDeleteCoach(
  options?: UseMutationOptions<void, Error, { username: string }>
) {
  return useMutation({
    mutationKey: getDeleteCoachMutationKey(),
    mutationFn: async ({ username }) => {
      await customFetch<void>(`/api/coaches/${encodeURIComponent(username)}`, {
        method: "DELETE",
      });
    },
    ...options,
  });
}

// ─── User profile PATCH ───────────────────────────────────────────────────────

export interface UserProfileUpdate {
  nom?: string;
  prenom?: string;
  categorie?: string;
  group?: string;
  dateNaissance?: string;
  nomParent?: string;
  numeroParent?: string;
  remarque?: string;
}

export const getUpdateUserProfileMutationKey = () => ["updateUserProfile"] as const;

export function useUpdateUserProfile(
  options?: UseMutationOptions<void, Error, { username: string; data: UserProfileUpdate }>
) {
  return useMutation({
    mutationKey: getUpdateUserProfileMutationKey(),
    mutationFn: async ({ username, data }) => {
      await customFetch<void>(`/api/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    ...options,
  });
}

// ─── Seance delete (coach/admin) ─────────────────────────────────────────────

export const getDeleteSeanceMutationKey = () => ["deleteSeance"] as const;

export function useDeleteSeance(
  options?: UseMutationOptions<void, Error, { id: string }>
) {
  return useMutation({
    mutationKey: getDeleteSeanceMutationKey(),
    mutationFn: async ({ id }) => {
      await customFetch<void>(`/api/seances/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    ...options,
  });
}

// ─── Seance cancel (coach) ────────────────────────────────────────────────────

export const getCancelSeanceMutationKey = () => ["cancelSeance"] as const;

export function useCancelSeance(
  options?: UseMutationOptions<void, Error, { id: string }>
) {
  return useMutation({
    mutationKey: getCancelSeanceMutationKey(),
    mutationFn: async ({ id }) => {
      await customFetch<void>(`/api/seances/${encodeURIComponent(id)}/cancel`, {
        method: "PATCH",
      });
    },
    ...options,
  });
}

// ─── Auto-activate trimester ──────────────────────────────────────────────────

export const getAutoActivateTrimesterMutationKey = () => ["autoActivateTrimester"] as const;

export function useAutoActivateTrimester(
  options?: UseMutationOptions<{ currentTrimester: string; currentAcademicYear: string; updatedAt: string }, Error, void>
) {
  return useMutation({
    mutationKey: getAutoActivateTrimesterMutationKey(),
    mutationFn: async () => {
      return customFetch<{ currentTrimester: string; currentAcademicYear: string; updatedAt: string }>(
        "/api/settings/trimester/auto",
        { method: "POST" }
      );
    },
    ...options,
  });
}

// ─── Presences bulk upsert for a séance ──────────────────────────────────────

export interface SeancePresenceEntry {
  studentUsername: string;
  status: "Présent" | "Absent" | "En retard" | "Excusé";
}

export interface BulkPresenceResult {
  saved: number;
}

export const getSaveSeancePresencesMutationKey = () => ["saveSeancePresences"] as const;

export function useSaveSeancePresences(
  options?: UseMutationOptions<BulkPresenceResult, Error, { seanceId: string; entries: SeancePresenceEntry[] }>
) {
  return useMutation({
    mutationKey: getSaveSeancePresencesMutationKey(),
    mutationFn: async ({ seanceId, entries }) => {
      return customFetch<BulkPresenceResult>(`/api/presences/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seanceId, entries }),
      });
    },
    ...options,
  });
}

// ─── Gallery: post photo assigned to a student ───────────────────────────────

export interface GalleryPhotoCreate {
  url: string;
  caption?: string;
  studentUsername?: string;
  seanceId?: string;
}

export interface GalleryPhoto {
  id: string;
  url: string;
  caption: string;
  uploadedAt: string;
  studentUsername: string | null;
  seanceId: string | null;
}

export function useGetGalleryAdmin(
  filters?: { studentUsername?: string; seanceId?: string },
  options?: Omit<UseQueryOptions<GalleryPhoto[]>, "queryKey" | "queryFn">
) {
  const params = new URLSearchParams();
  if (filters?.studentUsername) params.set("studentUsername", filters.studentUsername);
  if (filters?.seanceId) params.set("seanceId", filters.seanceId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return useQuery({
    queryKey: ["galleryAdmin", filters],
    queryFn: () => customFetch<GalleryPhoto[]>(`/api/gallery${qs}`),
    ...options,
  });
}

export function useGetMyGallery(
  options?: Omit<UseQueryOptions<GalleryPhoto[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: ["galleryMine"],
    queryFn: () => customFetch<GalleryPhoto[]>("/api/gallery"),
    ...options,
  });
}

export const getPostGalleryPhotoMutationKey = () => ["postGalleryPhoto"] as const;

export function usePostGalleryPhoto(
  options?: UseMutationOptions<GalleryPhoto, Error, GalleryPhotoCreate>
) {
  return useMutation({
    mutationKey: getPostGalleryPhotoMutationKey(),
    mutationFn: async (data) =>
      customFetch<GalleryPhoto>("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export const getDeleteGalleryPhotoMutationKey = () => ["deleteGalleryPhoto"] as const;

export function useDeleteGalleryPhoto(
  options?: UseMutationOptions<void, Error, { id: string }>
) {
  return useMutation({
    mutationKey: getDeleteGalleryPhotoMutationKey(),
    mutationFn: async ({ id }) => {
      await customFetch<void>(`/api/gallery/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    ...options,
  });
}

// ─── Get presences for a specific seance ─────────────────────────────────────

export interface SeancePresence {
  id: string;
  studentUsername: string;
  status: string;
  date: string;
  categorie: string;
  seanceId: string;
}

export function useGetSeancePresences(
  seanceId: string | null,
  options?: Omit<UseQueryOptions<SeancePresence[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: ["seancePresences", seanceId],
    queryFn: () =>
      customFetch<SeancePresence[]>(`/api/presences?seanceId=${encodeURIComponent(seanceId ?? "")}`),
    enabled: !!seanceId,
    ...options,
  });
}
