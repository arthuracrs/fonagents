export interface DaemonConfig {
    port?: number;
    projectDir?: string;
    bdPath?: string;
    anagentPath?: string;
    managerRuntimeId?: string;
}
export declare function startDaemon(opts?: DaemonConfig): void;
//# sourceMappingURL=daemon.d.ts.map