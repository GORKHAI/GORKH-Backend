const controllers = new Map<string, AbortController>();

export function createTaskController(taskId: string): AbortController {
  const controller = new AbortController();
  controllers.set(taskId, controller);
  return controller;
}

export function cancelTaskSignal(taskId: string): void {
  controllers.get(taskId)?.abort();
}

export function clearTaskController(taskId: string): void {
  controllers.delete(taskId);
}
