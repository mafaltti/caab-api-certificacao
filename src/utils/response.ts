function success(data: unknown) {
  return { success: true, data };
}

function successList(data: unknown[]) {
  return { success: true, count: data.length, data };
}

function error(message: string) {
  return { success: false, error: message };
}

export { success, successList, error };
