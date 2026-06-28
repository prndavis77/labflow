import axiosClient from "../api/axiosClient";

export const getAuditLogs = async ({
  page = 1,
  limit = 25,
  action,
  entityType,
  actorName,
  targetName,
} = {}) => {
  const params = {
    page,
    limit,
  };

  if (action) {
    params.action = action;
  }

  if (entityType) {
    params.entityType = entityType;
  }

  if (actorName) {
    params.actorName = actorName;
  }

  if (targetName) {
    params.targetName = targetName;
  }

  const response = await axiosClient.get("/audit-logs", { params });

  return response.data.data;
};
