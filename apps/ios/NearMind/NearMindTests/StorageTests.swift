import XCTest
@testable import NearMind

final class StorageTests: XCTestCase {
    func testStorageUsageDecoding() throws {
        let json = """
        {
          "usage": {
            "totalBytes": 2048,
            "transcriptBytes": 1024,
            "audioBytes": 0,
            "documentBytes": 0,
            "exportBytes": 512,
            "reportBytes": 512,
            "updatedAt": "2026-06-07T00:00:00.000Z"
          }
        }
        """
        let decoded = try JSONDecoder().decode(StorageUsageResponse.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.usage.totalBytes, 2048)
        XCTAssertEqual(decoded.usage.audioBytes, 0)
    }

    func testStorageObjectDecoding() throws {
        let json = """
        {
          "objects": [{
            "id": "object-id",
            "ownerType": "session",
            "ownerId": "session-id",
            "objectType": "transcript",
            "provider": "r2",
            "contentType": "application/json",
            "sizeBytes": 128,
            "sensitivity": "medium",
            "retentionPolicy": "standard",
            "status": "active",
            "createdAt": "2026-06-07T00:00:00.000Z",
            "archivedAt": null,
            "deletedAt": null
          }]
        }
        """
        let decoded = try JSONDecoder().decode(StorageObjectsResponse.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.objects.first?.objectType, "transcript")
        XCTAssertEqual(decoded.objects.first?.provider, "r2")
    }

    func testStorageEndpoints() throws {
        let baseURL = URL(string: "https://api.gorkh.com")!
        XCTAssertEqual(try Endpoint.storageUsage.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/storage/usage")
        XCTAssertEqual(try Endpoint.storageObjects.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/storage/objects")
        XCTAssertEqual(try Endpoint.storageDownloadURL(id: "abc").url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/storage/objects/abc/download-url")
    }

    func testStorageDeleteRequestEncodingContainsNoUserId() throws {
        let data = try JSONEncoder().encode(StorageDeletionRequest(reason: "manual"))
        let json = String(decoding: data, as: UTF8.self)
        XCTAssertFalse(json.contains("userId"))
        XCTAssertTrue(json.contains("manual"))
    }
}
