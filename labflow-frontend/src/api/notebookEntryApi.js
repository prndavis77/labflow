import axiosClient from "./axiosClient";

// Fetch notebook entries from the backend
// Optional filters can include experimentId, projectId, authorId, and entryType
export const fetchNotebookEntries = async (filters = {}) => {
  const response = await axiosClient.get("/notebook-entries", {
    params: filters,
  });

  return response.data;
};

// Fetch one notebook entry by ID
// This can be useful later for a standalone notebook entry detail page
export const fetchNotebookEntryById = async (notebookEntryId) => {
  const response = await axiosClient.get(
    `/notebook-entries/${notebookEntryId}`,
  );

  return response.data;
};

// Create a new experiment-linked notebook entry
// The backend derives projectId from experimentId and authorId from the logged-in user
export const createNotebookEntry = async (payload) => {
  const response = await axiosClient.post("notebook-entries", payload);

  return response.data;
};

// Update an existing notebook entry
// Researchers can only update their own entries. Admins and supervisors can update all entries
export const updateNotebookEntry = async (notebookEntryId, payload) => {
    const response = await axiosClient.patch(`/notebook-entries/${notebookEntryId}`, payload);

  return response.data;
};

// Delete an existing notebook entry
// Researchers can only delete their own entries. Admins and supervisors can delete all entries
export const deleteNotebookEntry = async  (notebookEntryId) => {
  const response = await axiosClient.delete(`/notebook-entries/${notebookEntryId}`);

  return response.data;
}