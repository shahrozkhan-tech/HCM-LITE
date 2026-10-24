"use client";

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { toast } from "sonner";

/** Base query that surfaces server error messages as sonner toasts. */
const baseQuery = fetchBaseQuery({ baseUrl: "/api" });

async function baseQueryWithErrorToast(args, api, extraOptions) {
  const result = await baseQuery(args, api, extraOptions);
  if (result.error && typeof window !== "undefined") {
    const msg =
      typeof result.error.data === "object" && result.error.data?.error
        ? result.error.data.error
        : `Request failed (${result.error.status})`;
    toast.error(msg);
  }
  return result;
}

/**
 * Single RTK Query API for the whole app. Every endpoint maps to a REST
 * route; role/data-scope checks live on the server.
 */
export const hcmApi = createApi({
  reducerPath: "hcmApi",
  baseQuery: baseQueryWithErrorToast,
  tagTypes: [
    "Me", "Org", "Settings", "Users", "Employees", "Employee", "Attendance",
    "Leaves", "Balance", "Payroll", "Dashboard", "Announcements", "Notifications", "Audit",
  ],
  endpoints: (builder) => ({
    // ── auth ────────────────────────────────────────────────────────────
    getMe: builder.query({ query: () => "/auth/me", providesTags: ["Me", "Notifications"] }),
    updateProfile: builder.mutation({
      query: (body) => ({ url: "/auth/profile", method: "PATCH", body }),
      invalidatesTags: ["Me", "Employees"],
    }),

    // ── first-run setup ─────────────────────────────────────────────────
    getSetupStatus: builder.query({ query: () => "/setup" }),
    runSetup: builder.mutation({ query: (body) => ({ url: "/setup", method: "POST", body }) }),

    // ── org ─────────────────────────────────────────────────────────────
    getOrg: builder.query({ query: () => "/org", providesTags: ["Org"] }),
    addOrgEntity: builder.mutation({
      query: (body) => ({ url: "/org", method: "POST", body }),
      invalidatesTags: ["Org"],
    }),
    deleteOrgEntity: builder.mutation({
      query: ({ entity, id }) => ({ url: `/org?entity=${entity}&id=${id}`, method: "DELETE" }),
      invalidatesTags: ["Org"],
    }),
    getSettings: builder.query({ query: () => "/settings", providesTags: ["Settings"] }),
    updateSettings: builder.mutation({
      query: (body) => ({ url: "/settings", method: "PUT", body }),
      invalidatesTags: ["Settings"],
    }),

    // ── users (admin) ───────────────────────────────────────────────────
    getUsers: builder.query({
      query: (params) => ({ url: "/users", params }),
      providesTags: ["Users"],
    }),
    createUser: builder.mutation({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: ["Users"],
    }),
    userAction: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Users"],
    }),

    // ── employees ───────────────────────────────────────────────────────
    getEmployees: builder.query({
      query: (params) => ({ url: "/employees", params }),
      providesTags: ["Employees"],
    }),
    getEmployee: builder.query({
      query: (id) => `/employees/${id}`,
      providesTags: (r, e, id) => [{ type: "Employee", id }, "Attendance", "Leaves", "Payroll"],
    }),
    createEmployee: builder.mutation({
      query: (body) => ({ url: "/employees", method: "POST", body }),
      invalidatesTags: ["Employees", "Dashboard"],
    }),
    updateEmployee: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}`, method: "PATCH", body }),
      invalidatesTags: (r, e, { id }) => [{ type: "Employee", id }, "Employees", "Dashboard"],
    }),
    importEmployees: builder.mutation({
      query: (body) => ({ url: "/employees/import", method: "POST", body }),
      invalidatesTags: ["Employees", "Dashboard"],
    }),

    // ── attendance ──────────────────────────────────────────────────────
    getToday: builder.query({ query: () => "/attendance/today", providesTags: ["Attendance"] }),
    checkIn: builder.mutation({
      query: (body) => ({ url: "/attendance/check-in", method: "POST", body }),
      invalidatesTags: ["Attendance", "Dashboard"],
    }),
    checkOut: builder.mutation({
      query: (body) => ({ url: "/attendance/check-out", method: "POST", body }),
      invalidatesTags: ["Attendance", "Dashboard"],
    }),
    getBoard: builder.query({
      query: (params) => ({ url: "/attendance/board", params }),
      providesTags: ["Attendance"],
    }),
    getMyAttendance: builder.query({
      query: (params) => ({ url: "/attendance/me", params }),
      providesTags: ["Attendance"],
    }),
    getCorrections: builder.query({
      query: () => "/attendance/corrections",
      providesTags: ["Attendance"],
    }),
    requestCorrection: builder.mutation({
      query: (body) => ({ url: "/attendance/corrections", method: "POST", body }),
      invalidatesTags: ["Attendance", "Dashboard"],
    }),
    decideCorrection: builder.mutation({
      query: (body) => ({ url: "/attendance/corrections", method: "PATCH", body }),
      invalidatesTags: ["Attendance", "Dashboard"],
    }),

    // ── leaves ──────────────────────────────────────────────────────────
    getLeaves: builder.query({
      query: (params) => ({ url: "/leaves", params }),
      providesTags: ["Leaves"],
    }),
    applyLeave: builder.mutation({
      query: (body) => ({ url: "/leaves", method: "POST", body }),
      invalidatesTags: ["Leaves", "Balance", "Dashboard"],
    }),
    leaveAction: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/leaves/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Leaves", "Balance", "Dashboard", "Attendance", "Notifications"],
    }),
    getBalance: builder.query({
      query: (params) => ({ url: "/leaves/balance", params }),
      providesTags: ["Balance"],
    }),

    // ── payroll ─────────────────────────────────────────────────────────
    getRuns: builder.query({ query: () => "/payroll/runs", providesTags: ["Payroll"] }),
    getRun: builder.query({
      query: (id) => `/payroll/runs/${id}`,
      providesTags: (r, e, id) => [{ type: "Payroll", id }],
    }),
    createRun: builder.mutation({
      query: (body) => ({ url: "/payroll/runs", method: "POST", body }),
      invalidatesTags: ["Payroll", "Dashboard"],
    }),
    deleteRun: builder.mutation({
      query: (id) => ({ url: `/payroll/runs/${id}`, method: "DELETE" }),
      invalidatesTags: ["Payroll", "Dashboard"],
    }),
    finalizeRun: builder.mutation({
      query: (id) => ({ url: `/payroll/runs/${id}/finalize`, method: "POST" }),
      invalidatesTags: ["Payroll", "Dashboard", "Notifications"],
    }),
    getMyPayslips: builder.query({ query: () => "/payroll/me", providesTags: ["Payroll"] }),

    // ── dashboard / comms / audit ───────────────────────────────────────
    getDashboard: builder.query({
      query: (params) => ({ url: "/dashboard", params }),
      providesTags: ["Dashboard"],
    }),
    getAnnouncements: builder.query({ query: () => "/announcements", providesTags: ["Announcements"] }),
    postAnnouncement: builder.mutation({
      query: (body) => ({ url: "/announcements", method: "POST", body }),
      invalidatesTags: ["Announcements", "Dashboard"],
    }),
    getNotifications: builder.query({ query: () => "/notifications", providesTags: ["Notifications"] }),
    markNotificationsRead: builder.mutation({
      query: (body) => ({ url: "/notifications", method: "PATCH", body }),
      invalidatesTags: ["Notifications", "Me"],
    }),
    getAudit: builder.query({
      query: (params) => ({ url: "/audit", params }),
      providesTags: ["Audit"],
    }),
    getEmails: builder.query({
      query: (arg = "") => `/emails${typeof arg === "string" && arg.startsWith("?") ? arg : ""}`,
      providesTags: ["Emails"],
    }),

    // ── AI ──────────────────────────────────────────────────────────────
    aiChat: builder.mutation({ query: (body) => ({ url: "/ai/chat", method: "POST", body }) }),
    aiSummary: builder.mutation({ query: (body) => ({ url: "/ai/summary", method: "POST", body }) }),
    aiSmartLeave: builder.mutation({ query: (body) => ({ url: "/ai/smart-leave", method: "POST", body }) }),
  }),
});

export const {
  useGetMeQuery, useUpdateProfileMutation,
  useGetSetupStatusQuery, useRunSetupMutation,
  useGetOrgQuery, useAddOrgEntityMutation, useDeleteOrgEntityMutation,
  useGetSettingsQuery, useUpdateSettingsMutation,
  useGetUsersQuery, useCreateUserMutation, useUserActionMutation,
  useGetEmployeesQuery, useGetEmployeeQuery, useCreateEmployeeMutation,
  useUpdateEmployeeMutation, useImportEmployeesMutation,
  useGetTodayQuery, useCheckInMutation, useCheckOutMutation,
  useGetBoardQuery, useGetMyAttendanceQuery, useGetCorrectionsQuery,
  useRequestCorrectionMutation, useDecideCorrectionMutation,
  useGetLeavesQuery, useApplyLeaveMutation, useLeaveActionMutation, useGetBalanceQuery,
  useGetRunsQuery, useGetRunQuery, useCreateRunMutation, useDeleteRunMutation,
  useFinalizeRunMutation, useGetMyPayslipsQuery,
  useGetDashboardQuery, useGetAnnouncementsQuery, usePostAnnouncementMutation,
  useGetNotificationsQuery, useMarkNotificationsReadMutation,
  useGetAuditQuery, useGetEmailsQuery,
  useAiChatMutation, useAiSummaryMutation, useAiSmartLeaveMutation,
} = hcmApi;
