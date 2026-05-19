// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CoffeeTrace
 * @notice Rastreabilidade de lotes de café — campos tipados on-chain.
 *
 * Solidity não suporta ponto flutuante. Convenções usadas pelos clientes:
 *   weightGrams      = kg * 1000
 *   latitudeE6       = grau decimal * 1_000_000
 *   longitudeE6      = grau decimal * 1_000_000
 *   temperatureCx100 = °C * 100
 *   humidityPctX100  = % * 100
 *   harvestTimestamp = unix seconds
 */
contract CoffeeTrace {
    // ─── Enums ────────────────────────────────────────────────────────────────

    enum CoffeeType { ARABICA, ROBUSTA, BLEND }

    enum ProcessingMethod { WASHED, NATURAL, HONEY, PULPED_NATURAL }

    enum RoastLevel { LIGHT, MEDIUM, DARK }

    enum TransportType { ROAD, SEA, RAIL }

    enum DeliveryCondition { GOOD, PARTIAL, DAMAGED }

    enum CertificationStandard { ORGANIC, FAIR_TRADE, RAINFOREST_ALLIANCE, OTHER }

    enum EventKind { PROCESSING, ROASTING, TRANSPORT, DELIVERY, CERTIFICATION_AUDIT }

    // ─── Structs: lote ────────────────────────────────────────────────────────

    struct Batch {
        string batchCode;
        CoffeeType coffeeType;
        uint256 weightGrams;
        string originFarm;
        string originCity;
        string originState;
        uint256 harvestTimestamp;
        string description;
        address owner;
        uint256 registeredAt;
        bool exists;
    }

    // ─── Structs: eventos por etapa ───────────────────────────────────────────

    struct ProcessingEvent {
        string location;
        int256 latitudeE6;
        int256 longitudeE6;
        ProcessingMethod method;
        string notes;
    }

    struct RoastingEvent {
        string location;
        int256 latitudeE6;
        int256 longitudeE6;
        uint256 temperatureCx100;
        uint256 humidityPctX100;
        uint256 durationMin;
        RoastLevel level;
        string notes;
    }

    struct TransportEvent {
        string fromLocation;
        int256 latitudeE6;
        int256 longitudeE6;
        TransportType transportType;
        string vehicleId;
        string notes;
    }

    struct DeliveryEvent {
        string location;
        int256 latitudeE6;
        int256 longitudeE6;
        DeliveryCondition condition;
        string recipientName;
        string notes;
    }

    struct CertificationAuditEvent {
        string location;
        int256 latitudeE6;
        int256 longitudeE6;
        string certificateNumber;
        CertificationStandard standard;
        string notes;
    }

    // Ponteiro ordenado no histórico do lote → resolve em um array específico por kind.
    struct EventRef {
        EventKind kind;
        uint256 index;
        address actor;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // ─── Certifica Minas ──────────────────────────────────────────────────────

    struct Certification {
        string propertyId;
        string onChainHash;
        uint256 issuedAt;
        uint256 validUntil;
        address issuer;
        bool exists;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    mapping(string => Batch) public batches;
    mapping(string => Certification) public certifications;

    mapping(string => EventRef[]) private _eventHistory;
    mapping(string => ProcessingEvent[]) private _processingEvents;
    mapping(string => RoastingEvent[]) private _roastingEvents;
    mapping(string => TransportEvent[]) private _transportEvents;
    mapping(string => DeliveryEvent[]) private _deliveryEvents;
    mapping(string => CertificationAuditEvent[]) private _certificationAuditEvents;

    // ─── Logs ─────────────────────────────────────────────────────────────────

    event BatchRegistered(
        string indexed batchId,
        string batchCode,
        address indexed owner,
        uint256 timestamp
    );

    event ProcessingEventAdded(string indexed batchId, address indexed actor, uint256 index, uint256 timestamp);
    event RoastingEventAdded(string indexed batchId, address indexed actor, uint256 index, uint256 timestamp);
    event TransportEventAdded(string indexed batchId, address indexed actor, uint256 index, uint256 timestamp);
    event DeliveryEventAdded(string indexed batchId, address indexed actor, uint256 index, uint256 timestamp);
    event CertificationAuditEventAdded(string indexed batchId, address indexed actor, uint256 index, uint256 timestamp);

    event CertificationRecorded(
        string indexed certId,
        string indexed propertyId,
        string onChainHash,
        address indexed issuer,
        uint256 validUntil
    );

    // ─── Write: batch ─────────────────────────────────────────────────────────

    function registerBatch(
        string calldata batchId,
        string calldata batchCode,
        CoffeeType coffeeType,
        uint256 weightGrams,
        string calldata originFarm,
        string calldata originCity,
        string calldata originState,
        uint256 harvestTimestamp,
        string calldata description
    ) external {
        require(!batches[batchId].exists, "CoffeeTrace: batch already registered");
        require(weightGrams > 0, "CoffeeTrace: weight must be positive");

        batches[batchId] = Batch({
            batchCode: batchCode,
            coffeeType: coffeeType,
            weightGrams: weightGrams,
            originFarm: originFarm,
            originCity: originCity,
            originState: originState,
            harvestTimestamp: harvestTimestamp,
            description: description,
            owner: msg.sender,
            registeredAt: block.timestamp,
            exists: true
        });

        emit BatchRegistered(batchId, batchCode, msg.sender, block.timestamp);
    }

    // ─── Write: eventos ───────────────────────────────────────────────────────

    function addProcessingEvent(
        string calldata batchId,
        string calldata location,
        int256 latitudeE6,
        int256 longitudeE6,
        ProcessingMethod method,
        string calldata notes
    ) external {
        require(batches[batchId].exists, "CoffeeTrace: batch not registered");
        uint256 idx = _processingEvents[batchId].length;
        _processingEvents[batchId].push(ProcessingEvent({
            location: location,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            method: method,
            notes: notes
        }));
        _eventHistory[batchId].push(EventRef({
            kind: EventKind.PROCESSING,
            index: idx,
            actor: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        emit ProcessingEventAdded(batchId, msg.sender, idx, block.timestamp);
    }

    function addRoastingEvent(
        string calldata batchId,
        string calldata location,
        int256 latitudeE6,
        int256 longitudeE6,
        uint256 temperatureCx100,
        uint256 humidityPctX100,
        uint256 durationMin,
        RoastLevel level,
        string calldata notes
    ) external {
        require(batches[batchId].exists, "CoffeeTrace: batch not registered");
        uint256 idx = _roastingEvents[batchId].length;
        _roastingEvents[batchId].push(RoastingEvent({
            location: location,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            temperatureCx100: temperatureCx100,
            humidityPctX100: humidityPctX100,
            durationMin: durationMin,
            level: level,
            notes: notes
        }));
        _eventHistory[batchId].push(EventRef({
            kind: EventKind.ROASTING,
            index: idx,
            actor: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        emit RoastingEventAdded(batchId, msg.sender, idx, block.timestamp);
    }

    function addTransportEvent(
        string calldata batchId,
        string calldata fromLocation,
        int256 latitudeE6,
        int256 longitudeE6,
        TransportType transportType,
        string calldata vehicleId,
        string calldata notes
    ) external {
        require(batches[batchId].exists, "CoffeeTrace: batch not registered");
        uint256 idx = _transportEvents[batchId].length;
        _transportEvents[batchId].push(TransportEvent({
            fromLocation: fromLocation,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            transportType: transportType,
            vehicleId: vehicleId,
            notes: notes
        }));
        _eventHistory[batchId].push(EventRef({
            kind: EventKind.TRANSPORT,
            index: idx,
            actor: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        emit TransportEventAdded(batchId, msg.sender, idx, block.timestamp);
    }

    function addDeliveryEvent(
        string calldata batchId,
        string calldata location,
        int256 latitudeE6,
        int256 longitudeE6,
        DeliveryCondition condition,
        string calldata recipientName,
        string calldata notes
    ) external {
        require(batches[batchId].exists, "CoffeeTrace: batch not registered");
        uint256 idx = _deliveryEvents[batchId].length;
        _deliveryEvents[batchId].push(DeliveryEvent({
            location: location,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            condition: condition,
            recipientName: recipientName,
            notes: notes
        }));
        _eventHistory[batchId].push(EventRef({
            kind: EventKind.DELIVERY,
            index: idx,
            actor: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        emit DeliveryEventAdded(batchId, msg.sender, idx, block.timestamp);
    }

    function addCertificationAuditEvent(
        string calldata batchId,
        string calldata location,
        int256 latitudeE6,
        int256 longitudeE6,
        string calldata certificateNumber,
        CertificationStandard standard,
        string calldata notes
    ) external {
        require(batches[batchId].exists, "CoffeeTrace: batch not registered");
        uint256 idx = _certificationAuditEvents[batchId].length;
        _certificationAuditEvents[batchId].push(CertificationAuditEvent({
            location: location,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            certificateNumber: certificateNumber,
            standard: standard,
            notes: notes
        }));
        _eventHistory[batchId].push(EventRef({
            kind: EventKind.CERTIFICATION_AUDIT,
            index: idx,
            actor: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));
        emit CertificationAuditEventAdded(batchId, msg.sender, idx, block.timestamp);
    }

    // ─── Write: Certifica Minas ───────────────────────────────────────────────

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

    // ─── Read: histórico ──────────────────────────────────────────────────────

    function getEventCount(string calldata batchId) external view returns (uint256) {
        return _eventHistory[batchId].length;
    }

    function getEventRef(string calldata batchId, uint256 index) external view returns (EventRef memory) {
        return _eventHistory[batchId][index];
    }

    function getProcessingEvent(string calldata batchId, uint256 index) external view returns (ProcessingEvent memory) {
        return _processingEvents[batchId][index];
    }

    function getRoastingEvent(string calldata batchId, uint256 index) external view returns (RoastingEvent memory) {
        return _roastingEvents[batchId][index];
    }

    function getTransportEvent(string calldata batchId, uint256 index) external view returns (TransportEvent memory) {
        return _transportEvents[batchId][index];
    }

    function getDeliveryEvent(string calldata batchId, uint256 index) external view returns (DeliveryEvent memory) {
        return _deliveryEvents[batchId][index];
    }

    function getCertificationAuditEvent(string calldata batchId, uint256 index) external view returns (CertificationAuditEvent memory) {
        return _certificationAuditEvents[batchId][index];
    }
}
