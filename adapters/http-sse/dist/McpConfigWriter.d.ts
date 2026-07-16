export type McpConfigFormat = 'claude-code' | 'opencode';
export interface WriteMcpConfigOpts {
    daemonUrl: string;
    mcpServerScript: string;
    format: McpConfigFormat;
}
export declare function writeMcpConfig(opts: WriteMcpConfigOpts): string;
//# sourceMappingURL=McpConfigWriter.d.ts.map