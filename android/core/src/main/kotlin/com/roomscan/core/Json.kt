package com.roomscan.core

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.UUID

/** Swift's JSONEncoder `.iso8601`: "2026-11-19T04:52:40Z", whole seconds, UTC. */
object InstantSerializer : KSerializer<Instant> {
    override val descriptor = PrimitiveSerialDescriptor("Instant", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: Instant) = encoder.encodeString(Dates.format(value))
    override fun deserialize(decoder: Decoder): Instant = Instant.parse(decoder.decodeString())
}

/** Foundation writes UUIDs upper-case; both cases are accepted on read. */
object UuidSerializer : KSerializer<UUID> {
    override val descriptor = PrimitiveSerialDescriptor("UUID", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: UUID) = encoder.encodeString(value.toString().uppercase())
    override fun deserialize(decoder: Decoder): UUID = UUID.fromString(decoder.decodeString())
}

object Dates {
    /** Current time truncated to whole seconds, so a save → load round trip is lossless. */
    fun now(): Instant = Instant.now().truncatedTo(ChronoUnit.SECONDS)
    fun format(i: Instant): String = DateTimeFormatter.ISO_INSTANT.format(i.truncatedTo(ChronoUnit.SECONDS))
}

class NewerSchemaException(val found: Int) :
    SerializationException("Project schema $found is newer than this app supports (${SurveyProject.CURRENT_SCHEMA_VERSION}).")

object ProjectJson {
    val json = Json {
        prettyPrint = true
        prettyPrintIndent = "  "
        encodeDefaults = true      // write empty lists / "" like Swift does
        explicitNulls = false      // omit null keys like Swift's synthesized Codable
        ignoreUnknownKeys = true   // tolerate keys added by a newer minor version
    }

    fun encode(p: SurveyProject): String = json.encodeToString(SurveyProject.serializer(), p)

    /** Rejects newer schemas before decoding the body, like the Swift decoder. */
    fun decode(text: String): SurveyProject {
        val root = json.parseToJsonElement(text).jsonObject
        val version = root["schemaVersion"]?.jsonPrimitive?.int
            ?: throw SerializationException("Missing schemaVersion")
        if (version > SurveyProject.CURRENT_SCHEMA_VERSION) throw NewerSchemaException(version)
        return json.decodeFromJsonElement(SurveyProject.serializer(), root)
    }
}
