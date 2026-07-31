import axiosClient from "../api/axiosClient";

export const getArchivedItems = async ({
  entityType,
  search,
  archivedFrom,
  archivedTo,
  page = 1,
  limit = 20,
}) => {
  const params = {
    entityType,
    page,
    limit,
  };

  if (search) {
    params.search = search;
  }

  if (archivedFrom) {
    params.archivedFrom = archivedFrom;
  }

  if (archivedTo) {
    params.archivedTo = archivedTo;
  }

  const response = await axiosClient.get("/admin/archived-items", {
    params,
  });

  return response.data.data;
};

export const restoreArchivedItem = async ({ entityType, id }) => {
  const response = await axiosClient.post(
    `/admin/archived-items/${entityType}/${id}/restore`,
  );

  return response.data;
};
