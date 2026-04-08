package com.vtbfamily.group.model

import jakarta.persistence.*
import java.time.LocalDateTime
import java.util.*

@Entity
@Table(name = "groups", schema = "family_wallet")
data class Group(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID = UUID.randomUUID(),
    
    @Column(nullable = false)
    var name: String,
    
    @Column(name = "owner_id", nullable = false)
    var ownerId: UUID,
    
    @Column(name = "tariff_tier")
    var tariffTier: String = "START",
    
    @Column(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now(),
    
    @Column(name = "updated_at")
    var updatedAt: LocalDateTime = LocalDateTime.now()
)