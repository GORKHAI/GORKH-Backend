import Foundation

struct StorageStatusResponse: Codable, Equatable {
    let storage: StorageStatus
    let fairUseLimitsApply: Bool?
}

struct StorageStatus: Codable, Equatable {
    let provider: String
    let configured: Bool
    let exportsEnabled: Bool?
    let transcriptArchiveEnabled: Bool?
    let audioSaveDefault: Bool?
    let maxObjectBytes: Int?
}

struct StorageUsageResponse: Codable, Equatable {
    let usage: StorageUsage
}

struct StorageUsage: Codable, Equatable {
    let totalBytes: Double
    let transcriptBytes: Double
    let audioBytes: Double
    let documentBytes: Double
    let exportBytes: Double
    let reportBytes: Double
    let updatedAt: String?
}

struct StorageObjectsResponse: Codable, Equatable {
    let objects: [StorageObjectSummary]
}

struct StorageObjectSummary: Codable, Identifiable, Equatable {
    let id: String
    let ownerType: String
    let ownerId: String
    let objectType: String
    let provider: String
    let contentType: String?
    let sizeBytes: Int?
    let sensitivity: String
    let retentionPolicy: String
    let status: String
    let createdAt: String
    let archivedAt: String?
    let deletedAt: String?
}

struct StorageExportResponse: Codable, Equatable {
    let export: StorageObjectSummary
}

struct StorageDownloadURLResponse: Codable, Equatable {
    let url: String
    let expiresInSeconds: Int
}

struct StorageDeletionRequest: Codable, Equatable {
    let reason: String?
}

struct StorageDeletionResponse: Codable, Equatable {
    let deletionRequest: StorageDeletionStatus
}

struct StorageDeletionStatus: Codable, Equatable {
    let status: String
    let message: String
    let destructiveDeleteExecuted: Bool
}

