package com.vtbfamily.group.controller

import com.vtbfamily.group.model.Group
import com.vtbfamily.group.service.GroupService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.*

@RestController
@RequestMapping("/api/groups")
class GroupController(private val groupService: GroupService) {
    
    @PostMapping
    fun createGroup(
        @RequestParam name: String,
        @RequestParam ownerId: UUID,
        @RequestParam(defaultValue = "START") tariffTier: String
    ): ResponseEntity<Any> {
        return try {
            val group = groupService.createGroup(name, ownerId, tariffTier)
            ResponseEntity.status(HttpStatus.CREATED).body(group)
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to e.message))
        }
    }
    
    @GetMapping
    fun getAllGroups() = ResponseEntity.ok(groupService.getAllGroups())
    
    @GetMapping("/{id}")
    fun getGroup(@PathVariable id: UUID): ResponseEntity<Group> {
        return groupService.getGroup(id)
            .map { ResponseEntity.ok(it) }
            .orElse(ResponseEntity.notFound().build())
    }
    
    @GetMapping("/health")
    fun health() = mapOf("status" to "UP", "service" to "group-service")
}