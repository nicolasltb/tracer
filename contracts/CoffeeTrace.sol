// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CoffeeTrace
 * @notice Rastreabilidade de lotes de café na rede Hyperledger Besu.
 *
 * Toda a informação do lote e seus eventos é armazenada on-chain.
 * O banco de dados da aplicação mantém apenas metadados operacionais
 * (usuários, QR tokens, índices).
 *
 * Funções de escrita:
 *   - registerBatch(batchId, batchCode, data) — registra um novo lote com dados completos
 *   - addEvent(batchId, eventType, data)      — adiciona evento ao lote
 *
 * Funções de leitura:
 *   - batches(batchId)                  — retorna dados do lote
 *   - getBatchEventCount(batchId)       — quantidade de eventos
 *   - getBatchEvent(batchId, index)     — retorna evento específico
 */
contract CoffeeTrace {
    struct Batch {
        string batchCode;
        string data;        // JSON com todos os campos do lote
        address owner;
        uint256 registeredAt;
        bool exists;
    }

    struct BatchEvent {
        string eventType;
        string data;        // JSON com todos os campos do evento
        address actor;
        uint256 timestamp;
        uint256 blockNumber;
    }

    struct Certification {
        string propertyId;
        string onChainHash;     // SHA-256 do payload + hashes dos documentos
        uint256 issuedAt;
        uint256 validUntil;
        address issuer;
        bool exists;
    }

    mapping(string => Batch) public batches;
    mapping(string => BatchEvent[]) private _batchEvents;
    mapping(string => Certification) public certifications;

    event BatchRegistered(
        string indexed batchId,
        string batchCode,
        address indexed owner,
        uint256 timestamp
    );

    event EventAdded(
        string indexed batchId,
        string eventType,
        address indexed actor,
        uint256 timestamp
    );

    event CertificationRecorded(
        string indexed certId,
        string indexed propertyId,
        string onChainHash,
        address indexed issuer,
        uint256 validUntil
    );

    // ─── Write ────────────────────────────────────────────────────────────────

    function registerBatch(
        string calldata batchId,
        string calldata batchCode,
        string calldata data
    ) external {
        require(!batches[batchId].exists, "CoffeeTrace: batch already registered");
        batches[batchId] = Batch({
            batchCode: batchCode,
            data: data,
            owner: msg.sender,
            registeredAt: block.timestamp,
            exists: true
        });
        emit BatchRegistered(batchId, batchCode, msg.sender, block.timestamp);
    }

    function addEvent(
        string calldata batchId,
        string calldata eventType,
        string calldata data
    ) external {
        require(batches[batchId].exists, "CoffeeTrace: batch not registered");
        _batchEvents[batchId].push(
            BatchEvent({
                eventType: eventType,
                data: data,
                actor: msg.sender,
                timestamp: block.timestamp,
                blockNumber: block.number
            })
        );
        emit EventAdded(batchId, eventType, msg.sender, block.timestamp);
    }

    function recordCertification(
        string calldata certId,
        string calldata propertyId,
        string calldata onChainHash,
        uint256 validUntil
    ) external {
        require(!certifications[certId].exists, "CoffeeTrace: certification already recorded");
        certifications[certId] = Certification({
            propertyId: propertyId,
            onChainHash: onChainHash,
            issuedAt: block.timestamp,
            validUntil: validUntil,
            issuer: msg.sender,
            exists: true
        });
        emit CertificationRecorded(certId, propertyId, onChainHash, msg.sender, validUntil);
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    function getBatchEventCount(string calldata batchId) external view returns (uint256) {
        return _batchEvents[batchId].length;
    }

    function getBatchEvent(string calldata batchId, uint256 index)
        external
        view
        returns (
            string memory eventType,
            string memory data,
            address actor,
            uint256 timestamp,
            uint256 blockNumber
        )
    {
        BatchEvent storage e = _batchEvents[batchId][index];
        return (e.eventType, e.data, e.actor, e.timestamp, e.blockNumber);
    }
}
