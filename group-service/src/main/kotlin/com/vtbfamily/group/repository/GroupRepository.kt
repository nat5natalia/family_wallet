package com.vtbfamily.group.repository

import com.vtbfamily.group.model.Group
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.*

@Repository
interface GroupRepository : JpaRepository<Group, UUID>