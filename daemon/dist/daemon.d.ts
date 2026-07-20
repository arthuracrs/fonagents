export interface DaemonConfig {
    port?: number;
    projectDir?: string;
    bdPath?: string;
    anagentPath?: string;
    managerRuntimeId?: string;
}
export interface DaemonHandle {
    port: number;
    mcpConfigPath: string;
    projectDir: string;
    managerRuntimeId: string;
}
export declare function startDaemon(opts?: DaemonConfig): Promise<DaemonHandle>;
export declare function stopDaemon(): void;
//# sourceMappingURL=daemon.d.ts.map